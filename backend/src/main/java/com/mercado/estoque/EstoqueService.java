package com.mercado.estoque;

import com.mercado.auth.Usuario;
import com.mercado.auth.UsuarioRepository;
import com.mercado.common.Pagina;
import com.mercado.produto.Produto;
import com.mercado.produto.ProdutoRepository;
import com.mercado.produto.Unidade;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class EstoqueService {
    private static final ZoneId ZONA = ZoneId.of("America/Sao_Paulo");
    private static final Set<TipoMovimentacao> MANUAIS =
            EnumSet.of(TipoMovimentacao.ENTRADA, TipoMovimentacao.SAIDA, TipoMovimentacao.AJUSTE);

    public record Request(
            @NotNull(message = "é obrigatório") Long produtoId,
            @NotNull(message = "é obrigatório") TipoMovimentacao tipo,
            @NotNull(message = "é obrigatória") @PositiveOrZero(message = "não pode ser negativa") BigDecimal quantidade,
            @Size(max = 200) String motivo) {}

    public record Response(Long id, Long produtoId, String produtoNome, String codigoBarras, Unidade unidade,
                           TipoMovimentacao tipo, BigDecimal quantidade,
                           BigDecimal saldoAnterior, BigDecimal saldoPosterior,
                           String motivo, String usuarioNome, Instant criadoEm) {
        static Response de(MovimentacaoEstoque m) {
            Produto p = m.getProduto();
            return new Response(m.getId(), p.getId(), p.getNome(), p.getCodigoBarras(), p.getUnidade(),
                    m.getTipo(), m.getQuantidade(), m.getSaldoAnterior(), m.getSaldoPosterior(),
                    m.getMotivo(), m.getUsuario().getNome(), m.getCriadoEm());
        }
    }

    public record Item(Long id, String codigoBarras, String nome, Unidade unidade,
                       BigDecimal estoqueAtual, BigDecimal estoqueMinimo, LocalDate validade) {
        static Item de(Produto p) {
            return new Item(p.getId(), p.getCodigoBarras(), p.getNome(), p.getUnidade(),
                    p.getEstoqueAtual(), p.getEstoqueMinimo(), p.getValidade());
        }
    }

    public record Alertas(List<Item> estoqueBaixo, List<Item> vencidos, List<Item> vencendo) {}

    public record Resumo(long totalProdutos, BigDecimal valorCusto, BigDecimal valorVenda,
                         int estoqueBaixo, int vencidos, int vencendo) {}

    private final ProdutoRepository produtos;
    private final MovimentacaoRepository movimentacoes;
    private final UsuarioRepository usuarios;

    /** Movimentação manual feita na tela de estoque. */
    @Transactional
    public Response registrar(Request r, String emailUsuario) {
        if (!MANUAIS.contains(r.tipo())) {
            throw erro(HttpStatus.BAD_REQUEST, "Use apenas Entrada, Saída ou Ajuste nesta tela");
        }
        Usuario usuario = usuarios.findByEmailIgnoreCase(emailUsuario).orElseThrow();
        Produto p = produtos.buscarParaAtualizar(r.produtoId()).filter(Produto::isAtivo)
                .orElseThrow(() -> erro(HttpStatus.NOT_FOUND, "Produto não encontrado"));

        BigDecimal qtd = r.quantidade();
        boolean fracionavel = p.getUnidade() == Unidade.KG || p.getUnidade() == Unidade.L;
        if (!fracionavel && qtd.stripTrailingZeros().scale() > 0) {
            throw erro(HttpStatus.BAD_REQUEST, "A unidade " + p.getUnidade() + " não aceita quantidade fracionada");
        }

        String motivo = r.motivo() == null || r.motivo().isBlank() ? null : r.motivo().trim();
        BigDecimal delta;
        switch (r.tipo()) {
            case ENTRADA -> {
                exigirPositiva(qtd);
                delta = qtd;
            }
            case SAIDA -> {
                exigirPositiva(qtd);
                if (motivo == null) throw erro(HttpStatus.BAD_REQUEST, "Informe o motivo da saída (perda, consumo interno…)");
                delta = qtd.negate();
            }
            default -> { // AJUSTE: a quantidade informada é o saldo contado
                if (motivo == null) throw erro(HttpStatus.BAD_REQUEST, "Informe o motivo do ajuste (ex.: inventário)");
                delta = qtd.subtract(p.getEstoqueAtual());
                if (delta.signum() == 0) throw erro(HttpStatus.BAD_REQUEST, "O saldo informado é igual ao saldo atual");
            }
        }
        return Response.de(aplicar(p, r.tipo(), delta, motivo, usuario));
    }

    /**
     * Núcleo da movimentação: atualiza o saldo e grava o histórico.
     * Deve ser chamado dentro de uma transação, com o produto já travado
     * (veja ProdutoRepository.buscarParaAtualizar). Vendas e compras reutilizam este método.
     */
    @Transactional
    public MovimentacaoEstoque aplicar(Produto p, TipoMovimentacao tipo, BigDecimal delta, String motivo, Usuario usuario) {
        BigDecimal anterior = p.getEstoqueAtual();
        BigDecimal posterior = anterior.add(delta);
        if (posterior.signum() < 0) {
            throw erro(HttpStatus.CONFLICT, "Estoque insuficiente de “" + p.getNome()
                    + "”: disponível " + anterior.stripTrailingZeros().toPlainString() + " " + p.getUnidade());
        }
        p.setEstoqueAtual(posterior);

        MovimentacaoEstoque m = new MovimentacaoEstoque();
        m.setProduto(p);
        m.setTipo(tipo);
        m.setQuantidade(delta);
        m.setSaldoAnterior(anterior);
        m.setSaldoPosterior(posterior);
        m.setMotivo(motivo);
        m.setUsuario(usuario);
        return movimentacoes.save(m);
    }

    @Transactional(readOnly = true)
    public Pagina<Response> historico(Long produtoId, TipoMovimentacao tipo, int pagina, int tamanho) {
        Specification<MovimentacaoEstoque> spec = (root, q, cb) -> cb.conjunction();
        if (produtoId != null) spec = spec.and((root, q, cb) -> cb.equal(root.get("produto").get("id"), produtoId));
        if (tipo != null) spec = spec.and((root, q, cb) -> cb.equal(root.get("tipo"), tipo));
        var pageable = PageRequest.of(Math.max(pagina, 0), Math.min(Math.max(tamanho, 1), 100),
                Sort.by(Sort.Direction.DESC, "criadoEm", "id"));
        return Pagina.de(movimentacoes.findAll(spec, pageable), Response::de);
    }

    @Transactional(readOnly = true)
    public Alertas alertas(int dias) {
        LocalDate hoje = LocalDate.now(ZONA);
        LocalDate limite = hoje.plusDays(Math.min(Math.max(dias, 1), 90));
        List<Produto> comValidade = produtos.comValidadeAte(limite);
        return new Alertas(
                produtos.estoqueBaixo().stream().map(Item::de).toList(),
                comValidade.stream().filter(p -> p.getValidade().isBefore(hoje)).map(Item::de).toList(),
                comValidade.stream().filter(p -> !p.getValidade().isBefore(hoje)).map(Item::de).toList());
    }

    @Transactional(readOnly = true)
    public Resumo resumo() {
        Alertas a = alertas(7);
        return new Resumo(produtos.countByAtivoTrue(), produtos.valorEmCusto(), produtos.valorEmVenda(),
                a.estoqueBaixo().size(), a.vencidos().size(), a.vencendo().size());
    }

    private static void exigirPositiva(BigDecimal q) {
        if (q.signum() <= 0) throw erro(HttpStatus.BAD_REQUEST, "A quantidade deve ser maior que zero");
    }

    private static ResponseStatusException erro(HttpStatus s, String msg) {
        return new ResponseStatusException(s, msg);
    }
}
