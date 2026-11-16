package com.mercado.venda;

import com.mercado.auth.Perfil;
import com.mercado.auth.Usuario;
import com.mercado.auth.UsuarioRepository;
import com.mercado.common.Pagina;
import com.mercado.estoque.EstoqueService;
import com.mercado.estoque.TipoMovimentacao;
import com.mercado.produto.Produto;
import com.mercado.produto.ProdutoRepository;
import com.mercado.produto.Unidade;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.*;

@Service
@RequiredArgsConstructor
public class VendaService {
    private static final ZoneId ZONA = ZoneId.of("America/Sao_Paulo");

    // ---- entrada ----
    public record ItemRequest(@NotNull(message = "é obrigatório") Long produtoId,
                              @NotNull(message = "é obrigatória") @Positive(message = "deve ser maior que zero") BigDecimal quantidade) {}
    public record PagamentoRequest(@NotNull(message = "é obrigatória") FormaPagamento forma,
                                   @NotNull(message = "é obrigatório") @Positive(message = "deve ser maior que zero") BigDecimal valor) {}
    public record Request(@NotEmpty(message = "não pode ser vazio") @Valid List<ItemRequest> itens,
                          @PositiveOrZero(message = "não pode ser negativo") BigDecimal desconto,
                          @NotEmpty(message = "não pode ser vazio") @Valid List<PagamentoRequest> pagamentos) {}
    public record CancelamentoRequest(@NotBlank(message = "é obrigatório") @Size(max = 200) String motivo) {}

    // ---- saída ----
    public record ItemResponse(Long produtoId, String codigoBarras, String nome, Unidade unidade,
                               BigDecimal quantidade, BigDecimal precoUnitario, BigDecimal total) {}
    public record PagamentoResponse(FormaPagamento forma, BigDecimal valor) {}
    public record Response(Long id, StatusVenda status, Instant criadoEm, String operador,
                           BigDecimal subtotal, BigDecimal desconto, BigDecimal total,
                           BigDecimal valorPago, BigDecimal troco,
                           List<ItemResponse> itens, List<PagamentoResponse> pagamentos,
                           Instant canceladaEm, String canceladaPor, String motivoCancelamento) {
        static Response de(Venda v) {
            return new Response(v.getId(), v.getStatus(), v.getCriadoEm(), v.getUsuario().getNome(),
                    v.getSubtotal(), v.getDesconto(), v.getTotal(), v.getValorPago(), v.getTroco(),
                    v.getItens().stream().map(i -> new ItemResponse(i.getProduto().getId(), i.getCodigoBarras(),
                            i.getNome(), i.getUnidade(), i.getQuantidade(), i.getPrecoUnitario(), i.getTotal())).toList(),
                    v.getPagamentos().stream().map(p -> new PagamentoResponse(p.getForma(), p.getValor())).toList(),
                    v.getCanceladaEm(), v.getCanceladaPor() == null ? null : v.getCanceladaPor().getNome(),
                    v.getMotivoCancelamento());
        }
    }
    public record Linha(Long id, StatusVenda status, Instant criadoEm, String operador, BigDecimal total,
                        int quantidadeItens, List<FormaPagamento> formas) {
        static Linha de(Venda v) {
            return new Linha(v.getId(), v.getStatus(), v.getCriadoEm(), v.getUsuario().getNome(), v.getTotal(),
                    v.getItens().size(), v.getPagamentos().stream().map(VendaPagamento::getForma).distinct().toList());
        }
    }
    public record Periodo(long quantidade, BigDecimal faturamento, BigDecimal ticketMedio) {}

    private final VendaRepository repo;
    private final ProdutoRepository produtos;
    private final UsuarioRepository usuarios;
    private final EstoqueService estoque;

    /**
     * Registra a venda de forma atômica: se qualquer item faltar no estoque ou o pagamento
     * não fechar, nada é gravado (a transação inteira é desfeita).
     */
    @Transactional
    public Response registrar(Request r, String email) {
        Usuario operador = usuario(email);

        // Une itens repetidos, mantendo a ordem do carrinho.
        Map<Long, BigDecimal> qtds = new LinkedHashMap<>();
        r.itens().forEach(i -> qtds.merge(i.produtoId(), i.quantidade(), BigDecimal::add));

        // Trava os produtos em ordem crescente de id: duas vendas simultâneas não geram deadlock.
        Map<Long, Produto> travados = new HashMap<>();
        for (Long id : new TreeSet<>(qtds.keySet())) {
            travados.put(id, produtos.buscarParaAtualizar(id).filter(Produto::isAtivo)
                    .orElseThrow(() -> erro(HttpStatus.BAD_REQUEST, "Produto " + id + " não encontrado ou inativo")));
        }

        Venda v = new Venda();
        v.setUsuario(operador);
        BigDecimal subtotal = BigDecimal.ZERO;
        for (var e : qtds.entrySet()) {
            Produto p = travados.get(e.getKey());
            BigDecimal q = e.getValue();
            if (!p.getUnidade().fracionavel() && q.stripTrailingZeros().scale() > 0) {
                throw erro(HttpStatus.BAD_REQUEST, "“" + p.getNome() + "” não aceita quantidade fracionada");
            }
            VendaItem it = new VendaItem();
            it.setVenda(v);
            it.setProduto(p);
            it.setCodigoBarras(p.getCodigoBarras());
            it.setNome(p.getNome());
            it.setUnidade(p.getUnidade());
            it.setQuantidade(q);
            it.setPrecoUnitario(p.getPrecoVenda());   // o preço vem do cadastro, nunca do navegador
            it.setCustoUnitario(p.getPrecoCusto());
            it.setTotal(p.getPrecoVenda().multiply(q).setScale(2, RoundingMode.HALF_UP));
            v.getItens().add(it);
            subtotal = subtotal.add(it.getTotal());
        }

        BigDecimal desconto = r.desconto() == null ? BigDecimal.ZERO : r.desconto().setScale(2, RoundingMode.HALF_UP);
        if (desconto.signum() > 0 && operador.getPerfil() == Perfil.CAIXA) {
            throw erro(HttpStatus.FORBIDDEN, "Desconto precisa ser aplicado por um gerente");
        }
        if (desconto.compareTo(subtotal) >= 0) {
            throw erro(HttpStatus.BAD_REQUEST, "O desconto deve ser menor que o subtotal");
        }
        BigDecimal total = subtotal.subtract(desconto);

        BigDecimal pago = BigDecimal.ZERO, emDinheiro = BigDecimal.ZERO;
        for (PagamentoRequest pr : r.pagamentos()) {
            BigDecimal valor = pr.valor().setScale(2, RoundingMode.HALF_UP);
            VendaPagamento vp = new VendaPagamento();
            vp.setVenda(v);
            vp.setForma(pr.forma());
            vp.setValor(valor);
            v.getPagamentos().add(vp);
            pago = pago.add(valor);
            if (pr.forma() == FormaPagamento.DINHEIRO) emDinheiro = emDinheiro.add(valor);
        }
        if (pago.compareTo(total) < 0) {
            throw erro(HttpStatus.BAD_REQUEST, "Pagamento insuficiente: faltam " + moeda(total.subtract(pago)));
        }
        BigDecimal troco = pago.subtract(total);
        if (troco.compareTo(emDinheiro) > 0) {
            throw erro(HttpStatus.BAD_REQUEST, "O troco só pode ser dado sobre o valor pago em dinheiro");
        }

        v.setSubtotal(subtotal);
        v.setDesconto(desconto);
        v.setTotal(total);
        v.setValorPago(pago);
        v.setTroco(troco);
        repo.save(v);

        for (var e : qtds.entrySet()) {
            estoque.aplicar(travados.get(e.getKey()), TipoMovimentacao.VENDA, e.getValue().negate(),
                    "Venda #" + v.getId(), operador);
        }
        return Response.de(v);
    }

    /** Cancela a venda e devolve os itens ao estoque (movimentação do tipo ESTORNO). */
    @Transactional
    public Response cancelar(Long id, String motivo, String email) {
        Usuario gerente = usuario(email);
        Venda v = repo.buscarParaAtualizar(id)
                .orElseThrow(() -> erro(HttpStatus.NOT_FOUND, "Venda não encontrada"));
        if (v.getStatus() != StatusVenda.CONCLUIDA) {
            throw erro(HttpStatus.CONFLICT, "Esta venda já foi cancelada");
        }
        Map<Long, BigDecimal> qtds = new TreeMap<>();
        v.getItens().forEach(i -> qtds.merge(i.getProduto().getId(), i.getQuantidade(), BigDecimal::add));
        for (var e : qtds.entrySet()) {
            Produto p = produtos.buscarParaAtualizar(e.getKey()).orElseThrow();
            estoque.aplicar(p, TipoMovimentacao.ESTORNO, e.getValue(), "Cancelamento da venda #" + id, gerente);
        }
        v.setStatus(StatusVenda.CANCELADA);
        v.setCanceladaEm(Instant.now());
        v.setCanceladaPor(gerente);
        v.setMotivoCancelamento(motivo.trim());
        return Response.de(v);
    }

    @Transactional(readOnly = true)
    public Response buscar(Long id, String email) {
        Usuario u = usuario(email);
        Venda v = repo.findById(id).filter(x -> podeVer(u, x))
                .orElseThrow(() -> erro(HttpStatus.NOT_FOUND, "Venda não encontrada"));
        return Response.de(v);
    }

    @Transactional(readOnly = true)
    public Pagina<Linha> listar(LocalDate de, LocalDate ate, StatusVenda status, int pagina, int tamanho, String email) {
        Usuario u = usuario(email);
        Specification<Venda> spec = (root, q, cb) -> cb.conjunction();
        if (u.getPerfil() == Perfil.CAIXA) spec = spec.and((root, q, cb) -> cb.equal(root.get("usuario").get("id"), u.getId()));
        if (de != null) spec = spec.and((root, q, cb) -> cb.greaterThanOrEqualTo(root.get("criadoEm"), inicio(de)));
        if (ate != null) spec = spec.and((root, q, cb) -> cb.lessThan(root.get("criadoEm"), inicio(ate.plusDays(1))));
        if (status != null) spec = spec.and((root, q, cb) -> cb.equal(root.get("status"), status));
        var pageable = PageRequest.of(Math.max(pagina, 0), Math.min(Math.max(tamanho, 1), 100),
                Sort.by(Sort.Direction.DESC, "criadoEm", "id"));
        return Pagina.de(repo.findAll(spec, pageable), Linha::de);
    }

    @Transactional(readOnly = true)
    public Periodo periodo(LocalDate de, LocalDate ate) {
        Instant ini = inicio(de), fim = inicio(ate.plusDays(1));
        long qtd = repo.contarConcluidas(ini, fim);
        BigDecimal soma = repo.somarConcluidas(ini, fim);
        BigDecimal ticket = qtd == 0 ? BigDecimal.ZERO : soma.divide(BigDecimal.valueOf(qtd), 2, RoundingMode.HALF_UP);
        return new Periodo(qtd, soma, ticket);
    }

    private boolean podeVer(Usuario u, Venda v) {
        return u.getPerfil() != Perfil.CAIXA || v.getUsuario().getId().equals(u.getId());
    }

    private Usuario usuario(String email) { return usuarios.findByEmailIgnoreCase(email).orElseThrow(); }

    private static Instant inicio(LocalDate d) { return d.atStartOfDay(ZONA).toInstant(); }

    private static String moeda(BigDecimal v) { return String.format(Locale.of("pt", "BR"), "R$ %,.2f", v); }

    private static ResponseStatusException erro(HttpStatus s, String msg) { return new ResponseStatusException(s, msg); }
}
