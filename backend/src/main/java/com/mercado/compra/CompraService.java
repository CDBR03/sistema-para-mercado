package com.mercado.compra;

import com.mercado.auth.Usuario;
import com.mercado.auth.UsuarioRepository;
import com.mercado.common.Pagina;
import com.mercado.estoque.EstoqueService;
import com.mercado.estoque.TipoMovimentacao;
import com.mercado.financeiro.FinanceiroService;
import com.mercado.fornecedor.Fornecedor;
import com.mercado.fornecedor.FornecedorRepository;
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
import java.util.*;

@Service
@RequiredArgsConstructor
public class CompraService {

    // ---- entrada ----
    public record ItemRequest(@NotNull(message = "é obrigatório") Long produtoId,
                              @NotNull(message = "é obrigatória") @Positive(message = "deve ser maior que zero") BigDecimal quantidade,
                              @PositiveOrZero(message = "não pode ser negativo") BigDecimal custoUnitario) {}

    public record Request(@NotNull(message = "é obrigatório") Long fornecedorId,
                          LocalDate previsaoEntrega,
                          @Size(max = 300) String observacao,
                          @Min(value = 1, message = "mínimo 1") @Max(value = 24, message = "máximo 24") Integer parcelas,
                          @Min(value = 0, message = "não pode ser negativo") @Max(value = 365, message = "máximo 365") Integer primeiroVencimentoDias,
                          @Min(value = 1, message = "mínimo 1") @Max(value = 180, message = "máximo 180") Integer intervaloDias,
                          @NotEmpty(message = "não pode ser vazio") @Valid List<ItemRequest> itens) {}

    public record ItemRecebido(@NotNull(message = "é obrigatório") Long itemId,
                               @NotNull(message = "é obrigatória") @PositiveOrZero(message = "não pode ser negativa") BigDecimal quantidade,
                               @PositiveOrZero(message = "não pode ser negativo") BigDecimal custoUnitario) {}

    /** Sem itens = recebimento integral, como pedido. */
    public record Recebimento(@Size(max = 60) String numeroNota, @Valid List<ItemRecebido> itens) {}

    public record Cancelamento(@NotBlank(message = "é obrigatório") @Size(max = 200) String motivo) {}

    // ---- saída ----
    public record ItemResponse(Long id, Long produtoId, String codigoBarras, String nome, Unidade unidade,
                               BigDecimal quantidade, BigDecimal custoUnitario, BigDecimal total,
                               BigDecimal quantidadeRecebida, BigDecimal custoRecebido,
                               BigDecimal estoqueAtual, BigDecimal estoqueMinimo) {
        static ItemResponse de(PedidoCompraItem i) {
            Produto p = i.getProduto();
            return new ItemResponse(i.getId(), p.getId(), p.getCodigoBarras(), p.getNome(), p.getUnidade(),
                    i.getQuantidade(), i.getCustoUnitario(), i.getTotal(),
                    i.getQuantidadeRecebida(), i.getCustoRecebido(), p.getEstoqueAtual(), p.getEstoqueMinimo());
        }
    }

    public record Response(Long id, StatusPedido status, Long fornecedorId, String fornecedorNome,
                           LocalDate previsaoEntrega, String observacao,
                           int parcelas, int primeiroVencimentoDias, int intervaloDias,
                           BigDecimal total, BigDecimal totalRecebido, String numeroNota,
                           String criadoPor, Instant criadoEm, String recebidoPor, Instant recebidoEm,
                           String canceladoPor, Instant canceladoEm, String motivoCancelamento,
                           List<ItemResponse> itens, List<FinanceiroService.Response> contas) {
        static Response de(PedidoCompra p, List<FinanceiroService.Response> contas) {
            return new Response(p.getId(), p.getStatus(), p.getFornecedor().getId(), p.getFornecedor().getRazaoSocial(),
                    p.getPrevisaoEntrega(), p.getObservacao(),
                    p.getParcelas(), p.getPrimeiroVencimentoDias(), p.getIntervaloDias(),
                    p.getTotal(), p.getTotalRecebido(), p.getNumeroNota(),
                    p.getCriadoPor().getNome(), p.getCriadoEm(),
                    p.getRecebidoPor() == null ? null : p.getRecebidoPor().getNome(), p.getRecebidoEm(),
                    p.getCanceladoPor() == null ? null : p.getCanceladoPor().getNome(), p.getCanceladoEm(),
                    p.getMotivoCancelamento(),
                    p.getItens().stream().map(ItemResponse::de).toList(), contas);
        }
    }

    public record Linha(Long id, StatusPedido status, String fornecedorNome, int quantidadeItens,
                        BigDecimal total, BigDecimal totalRecebido, LocalDate previsaoEntrega,
                        boolean atrasado, Instant criadoEm, Instant recebidoEm) {
        static Linha de(PedidoCompra p) {
            boolean atrasado = p.getStatus() == StatusPedido.ABERTO && p.getPrevisaoEntrega() != null
                    && p.getPrevisaoEntrega().isBefore(LocalDate.now(FinanceiroService.ZONA));
            return new Linha(p.getId(), p.getStatus(), p.getFornecedor().getRazaoSocial(), p.getItens().size(),
                    p.getTotal(), p.getTotalRecebido(), p.getPrevisaoEntrega(), atrasado,
                    p.getCriadoEm(), p.getRecebidoEm());
        }
    }

    public record Sugestao(Long produtoId, String codigoBarras, String nome, Unidade unidade,
                           Long fornecedorId, String fornecedorNome,
                           BigDecimal estoqueAtual, BigDecimal estoqueMinimo,
                           BigDecimal quantidadeSugerida, BigDecimal custoUnitario) {}

    private final PedidoCompraRepository repo;
    private final FornecedorRepository fornecedores;
    private final ProdutoRepository produtos;
    private final UsuarioRepository usuarios;
    private final EstoqueService estoque;
    private final FinanceiroService financeiro;

    @Transactional
    public Response criar(Request r, String email) {
        PedidoCompra p = new PedidoCompra();
        p.setCriadoPor(usuario(email));
        preencher(p, r);
        repo.save(p);
        return Response.de(p, List.of());
    }

    @Transactional
    public Response atualizar(Long id, Request r) {
        PedidoCompra p = travar(id);
        if (p.getStatus() != StatusPedido.ABERTO) throw erro(HttpStatus.CONFLICT, "Só é possível editar pedidos em aberto");
        preencher(p, r);
        return Response.de(p, List.of());
    }

    private void preencher(PedidoCompra p, Request r) {
        Fornecedor f = fornecedores.findById(r.fornecedorId()).filter(Fornecedor::isAtivo)
                .orElseThrow(() -> erro(HttpStatus.BAD_REQUEST, "Fornecedor não encontrado ou inativo"));
        p.setFornecedor(f);
        p.setPrevisaoEntrega(r.previsaoEntrega());
        p.setObservacao(r.observacao() == null || r.observacao().isBlank() ? null : r.observacao().trim());
        p.setParcelas(r.parcelas() == null ? 1 : r.parcelas());
        p.setPrimeiroVencimentoDias(r.primeiroVencimentoDias() == null ? 30 : r.primeiroVencimentoDias());
        p.setIntervaloDias(r.intervaloDias() == null ? 30 : r.intervaloDias());

        // Une linhas do mesmo produto (somando quantidades; vale o último custo informado).
        Map<Long, ItemRequest> unidos = new LinkedHashMap<>();
        for (ItemRequest i : r.itens()) {
            unidos.merge(i.produtoId(), i, (a, b) -> new ItemRequest(a.produtoId(), a.quantidade().add(b.quantidade()),
                    b.custoUnitario() != null ? b.custoUnitario() : a.custoUnitario()));
        }
        p.getItens().clear();
        BigDecimal total = BigDecimal.ZERO;
        for (ItemRequest i : unidos.values()) {
            Produto prod = produtos.findById(i.produtoId()).filter(Produto::isAtivo)
                    .orElseThrow(() -> erro(HttpStatus.BAD_REQUEST, "Produto " + i.produtoId() + " não encontrado ou inativo"));
            exigirInteira(prod, i.quantidade());
            BigDecimal custo = (i.custoUnitario() == null ? prod.getPrecoCusto() : i.custoUnitario())
                    .setScale(2, RoundingMode.HALF_UP);
            PedidoCompraItem it = new PedidoCompraItem();
            it.setPedido(p);
            it.setProduto(prod);
            it.setQuantidade(i.quantidade());
            it.setCustoUnitario(custo);
            it.setTotal(custo.multiply(i.quantidade()).setScale(2, RoundingMode.HALF_UP));
            p.getItens().add(it);
            total = total.add(it.getTotal());
        }
        p.setTotal(total);
    }

    /**
     * Recebe a mercadoria: dá entrada no estoque (movimentação COMPRA), recalcula o custo médio
     * dos produtos e gera as parcelas no contas a pagar. Tudo ou nada.
     */
    @Transactional
    public Response receber(Long id, Recebimento r, String email) {
        Usuario u = usuario(email);
        PedidoCompra p = travar(id);
        if (p.getStatus() != StatusPedido.ABERTO) throw erro(HttpStatus.CONFLICT, "Este pedido não está em aberto");

        Map<Long, ItemRecebido> informados = new HashMap<>();
        if (r != null && r.itens() != null) r.itens().forEach(i -> informados.put(i.itemId(), i));
        Set<Long> idsDoPedido = new HashSet<>();
        p.getItens().forEach(i -> idsDoPedido.add(i.getId()));
        if (!idsDoPedido.containsAll(informados.keySet())) throw erro(HttpStatus.BAD_REQUEST, "Item não pertence a este pedido");

        // Trava os produtos em ordem de id (mesma regra das vendas, evita deadlock).
        List<PedidoCompraItem> itens = new ArrayList<>(p.getItens());
        itens.sort(Comparator.comparing(i -> i.getProduto().getId()));

        BigDecimal totalRecebido = BigDecimal.ZERO;
        for (PedidoCompraItem it : itens) {
            ItemRecebido inf = informados.get(it.getId());
            BigDecimal qtd = inf == null ? it.getQuantidade() : inf.quantidade();
            BigDecimal custo = (inf == null || inf.custoUnitario() == null ? it.getCustoUnitario() : inf.custoUnitario())
                    .setScale(2, RoundingMode.HALF_UP);
            it.setQuantidadeRecebida(qtd);
            it.setCustoRecebido(custo);
            if (qtd.signum() == 0) continue;

            Produto prod = produtos.buscarParaAtualizar(it.getProduto().getId()).orElseThrow();
            exigirInteira(prod, qtd);
            prod.setPrecoCusto(custoMedio(prod.getEstoqueAtual(), prod.getPrecoCusto(), qtd, custo));
            estoque.aplicar(prod, TipoMovimentacao.COMPRA, qtd, "Pedido de compra #" + p.getId(), u);
            totalRecebido = totalRecebido.add(custo.multiply(qtd).setScale(2, RoundingMode.HALF_UP));
        }
        if (totalRecebido.signum() == 0) {
            throw erro(HttpStatus.BAD_REQUEST, "Nenhum item recebido. Para desistir do pedido, cancele-o.");
        }

        p.setStatus(StatusPedido.RECEBIDO);
        p.setNumeroNota(r == null || r.numeroNota() == null || r.numeroNota().isBlank() ? null : r.numeroNota().trim());
        p.setTotalRecebido(totalRecebido);
        p.setRecebidoEm(Instant.now());
        p.setRecebidoPor(u);
        financeiro.gerarParcelasCompra(p, totalRecebido, LocalDate.now(FinanceiroService.ZONA), u);
        return Response.de(p, financeiro.doPedido(p.getId()));
    }

    @Transactional
    public Response cancelar(Long id, String motivo, String email) {
        PedidoCompra p = travar(id);
        if (p.getStatus() != StatusPedido.ABERTO) throw erro(HttpStatus.CONFLICT, "Só é possível cancelar pedidos em aberto");
        p.setStatus(StatusPedido.CANCELADO);
        p.setCanceladoEm(Instant.now());
        p.setCanceladoPor(usuario(email));
        p.setMotivoCancelamento(motivo.trim());
        return Response.de(p, List.of());
    }

    @Transactional(readOnly = true)
    public Response buscar(Long id) {
        PedidoCompra p = repo.findById(id).orElseThrow(() -> erro(HttpStatus.NOT_FOUND, "Pedido não encontrado"));
        return Response.de(p, financeiro.doPedido(id));
    }

    @Transactional(readOnly = true)
    public Pagina<Linha> listar(StatusPedido status, Long fornecedorId, int pagina, int tamanho) {
        Specification<PedidoCompra> spec = (root, q, cb) -> cb.conjunction();
        if (status != null) spec = spec.and((root, q, cb) -> cb.equal(root.get("status"), status));
        if (fornecedorId != null) spec = spec.and((root, q, cb) -> cb.equal(root.get("fornecedor").get("id"), fornecedorId));
        var pageable = PageRequest.of(Math.max(pagina, 0), Math.min(Math.max(tamanho, 1), 100),
                Sort.by(Sort.Direction.DESC, "criadoEm", "id"));
        return Pagina.de(repo.findAll(spec, pageable), Linha::de);
    }

    /**
     * Produtos no estoque mínimo ou abaixo dele, com a quantidade para voltar ao dobro do mínimo.
     * Com fornecedor informado, traz só os produtos dele.
     */
    @Transactional(readOnly = true)
    public List<Sugestao> sugestao(Long fornecedorId) {
        return produtos.estoqueBaixo().stream()
                .filter(p -> fornecedorId == null || (p.getFornecedor() != null && p.getFornecedor().getId().equals(fornecedorId)))
                .map(p -> {
                    BigDecimal alvo = p.getEstoqueMinimo().multiply(BigDecimal.valueOf(2));
                    BigDecimal q = alvo.subtract(p.getEstoqueAtual()).max(BigDecimal.ONE);
                    q = p.getUnidade().fracionavel() ? q.setScale(3, RoundingMode.UP) : q.setScale(0, RoundingMode.CEILING);
                    Fornecedor f = p.getFornecedor();
                    return new Sugestao(p.getId(), p.getCodigoBarras(), p.getNome(), p.getUnidade(),
                            f == null ? null : f.getId(), f == null ? null : f.getRazaoSocial(),
                            p.getEstoqueAtual(), p.getEstoqueMinimo(), q, p.getPrecoCusto());
                }).toList();
    }

    public long abertos() { return repo.countByStatus(StatusPedido.ABERTO); }

    /** Custo médio ponderado. Com saldo zerado ou negativo, vale o custo da nova compra. */
    static BigDecimal custoMedio(BigDecimal saldo, BigDecimal custoAtual, BigDecimal qtd, BigDecimal custoCompra) {
        if (saldo.signum() <= 0) return custoCompra;
        return saldo.multiply(custoAtual).add(qtd.multiply(custoCompra))
                .divide(saldo.add(qtd), 2, RoundingMode.HALF_UP);
    }

    private static void exigirInteira(Produto p, BigDecimal q) {
        if (!p.getUnidade().fracionavel() && q.stripTrailingZeros().scale() > 0) {
            throw erro(HttpStatus.BAD_REQUEST, "“" + p.getNome() + "” não aceita quantidade fracionada");
        }
    }

    private PedidoCompra travar(Long id) {
        return repo.buscarParaAtualizar(id).orElseThrow(() -> erro(HttpStatus.NOT_FOUND, "Pedido não encontrado"));
    }

    private Usuario usuario(String email) { return usuarios.findByEmailIgnoreCase(email).orElseThrow(); }

    private static ResponseStatusException erro(HttpStatus s, String msg) { return new ResponseStatusException(s, msg); }
}
