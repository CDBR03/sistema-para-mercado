package com.mercado.financeiro;

import com.mercado.auth.Usuario;
import com.mercado.auth.UsuarioRepository;
import com.mercado.common.Pagina;
import com.mercado.compra.PedidoCompra;
import com.mercado.fornecedor.Fornecedor;
import com.mercado.fornecedor.FornecedorRepository;
import com.mercado.venda.FormaPagamento;
import jakarta.validation.constraints.*;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.*;

@Service
@RequiredArgsConstructor
public class FinanceiroService {
    public static final ZoneId ZONA = ZoneId.of("America/Sao_Paulo");

    // ---- entrada ----
    public record Request(@NotNull(message = "é obrigatório") TipoConta tipo,
                          @NotBlank(message = "é obrigatória") @Size(max = 160) String descricao,
                          @NotNull(message = "é obrigatória") CategoriaConta categoria,
                          Long fornecedorId,
                          @NotNull(message = "é obrigatório") @Positive(message = "deve ser maior que zero") BigDecimal valor,
                          @NotNull(message = "é obrigatório") LocalDate vencimento,
                          @Min(value = 1, message = "mínimo 1") @Max(value = 24, message = "máximo 24") Integer repeticoes,
                          @Size(max = 300) String observacao) {}

    public record Atualizacao(@NotBlank(message = "é obrigatória") @Size(max = 160) String descricao,
                              @NotNull(message = "é obrigatória") CategoriaConta categoria,
                              Long fornecedorId,
                              @NotNull(message = "é obrigatório") @Positive(message = "deve ser maior que zero") BigDecimal valor,
                              @NotNull(message = "é obrigatório") LocalDate vencimento,
                              @Size(max = 300) String observacao) {}

    public record Baixa(LocalDate pagoEm,
                        @Positive(message = "deve ser maior que zero") BigDecimal valorPago,
                        @NotNull(message = "é obrigatória") FormaPagamento forma) {}

    public record Cancelamento(@NotBlank(message = "é obrigatório") @Size(max = 200) String motivo) {}

    // ---- saída ----
    public record Response(Long id, TipoConta tipo, String descricao, CategoriaConta categoria,
                           Long fornecedorId, String fornecedorNome, Long pedidoCompraId, String parcela,
                           BigDecimal valor, LocalDate vencimento, StatusConta status, Long diasAtraso,
                           LocalDate pagoEm, BigDecimal valorPago, FormaPagamento formaPagamento,
                           String observacao, String criadoPor, Instant criadoEm,
                           String baixadoPor, String canceladoPor, String motivoCancelamento) {
        static Response de(Conta c) {
            LocalDate hoje = LocalDate.now(ZONA);
            boolean vencida = c.getStatus() == StatusConta.ABERTA && c.getVencimento().isBefore(hoje);
            return new Response(c.getId(), c.getTipo(), c.getDescricao(), c.getCategoria(),
                    c.getFornecedor() == null ? null : c.getFornecedor().getId(),
                    c.getFornecedor() == null ? null : c.getFornecedor().getRazaoSocial(),
                    c.getPedidoCompra() == null ? null : c.getPedidoCompra().getId(), c.getParcela(),
                    c.getValor(), c.getVencimento(), vencida ? StatusConta.VENCIDA : c.getStatus(),
                    vencida ? ChronoUnit.DAYS.between(c.getVencimento(), hoje) : null,
                    c.getPagoEm(), c.getValorPago(), c.getFormaPagamento(), c.getObservacao(),
                    c.getCriadoPor().getNome(), c.getCriadoEm(),
                    c.getBaixadoPor() == null ? null : c.getBaixadoPor().getNome(),
                    c.getCanceladoPor() == null ? null : c.getCanceladoPor().getNome(),
                    c.getMotivoCancelamento());
        }
    }

    public record Totais(long quantidade, BigDecimal valor) {}
    public record Resumo(Totais pagarVencidas, Totais pagarHoje, Totais pagarProximos7,
                         Totais receberVencidas, Totais receberProximos7,
                         BigDecimal pagoNoMes, BigDecimal recebidoNoMes) {}

    public record DiaFluxo(LocalDate data, BigDecimal vendas, BigDecimal outrasEntradas,
                           BigDecimal saidas, BigDecimal saldoDia, BigDecimal saldoAcumulado) {}
    public record Fluxo(LocalDate de, LocalDate ate, BigDecimal totalVendas, BigDecimal totalOutrasEntradas,
                        BigDecimal totalSaidas, BigDecimal resultado, List<DiaFluxo> dias,
                        Totais aPagarNoPeriodo, Totais aReceberNoPeriodo) {}

    private final ContaRepository repo;
    private final UsuarioRepository usuarios;
    private final FornecedorRepository fornecedores;
    private final NamedParameterJdbcTemplate jdbc;

    /** Lança uma conta manual. Com `repeticoes` > 1 cria uma conta por mês (aluguel, energia…). */
    @Transactional
    public List<Response> criar(Request r, String email) {
        Usuario u = usuario(email);
        validarCategoria(r.tipo(), r.categoria());
        Fornecedor f = fornecedor(r.fornecedorId());
        int n = r.repeticoes() == null ? 1 : r.repeticoes();
        List<Conta> criadas = new ArrayList<>();
        for (int i = 0; i < n; i++) {
            Conta c = new Conta();
            c.setTipo(r.tipo());
            c.setDescricao(r.descricao().trim());
            c.setCategoria(r.categoria());
            c.setFornecedor(f);
            c.setValor(r.valor().setScale(2, RoundingMode.HALF_UP));
            c.setVencimento(r.vencimento().plusMonths(i));
            c.setParcela(n > 1 ? (i + 1) + "/" + n : null);
            c.setObservacao(vazioParaNulo(r.observacao()));
            c.setCriadoPor(u);
            criadas.add(repo.save(c));
        }
        return criadas.stream().map(Response::de).toList();
    }

    /**
     * Gera as parcelas a pagar de um pedido de compra recebido.
     * A última parcela absorve a diferença de arredondamento.
     */
    @Transactional
    public List<Conta> gerarParcelasCompra(PedidoCompra p, BigDecimal total, LocalDate base, Usuario u) {
        if (total.signum() <= 0) return List.of();
        int n = p.getParcelas();
        BigDecimal parte = total.divide(BigDecimal.valueOf(n), 2, RoundingMode.DOWN);
        List<Conta> contas = new ArrayList<>();
        for (int i = 0; i < n; i++) {
            Conta c = new Conta();
            c.setTipo(TipoConta.PAGAR);
            c.setCategoria(CategoriaConta.FORNECEDOR);
            c.setDescricao("Pedido de compra #" + p.getId()
                    + (p.getNumeroNota() == null ? "" : " · NF " + p.getNumeroNota()));
            c.setFornecedor(p.getFornecedor());
            c.setPedidoCompra(p);
            c.setParcela(n > 1 ? (i + 1) + "/" + n : null);
            c.setValor(i == n - 1 ? total.subtract(parte.multiply(BigDecimal.valueOf(n - 1))) : parte);
            c.setVencimento(base.plusDays(p.getPrimeiroVencimentoDias() + (long) i * p.getIntervaloDias()));
            c.setCriadoPor(u);
            contas.add(repo.save(c));
        }
        return contas;
    }

    @Transactional
    public Response atualizar(Long id, Atualizacao r) {
        Conta c = travar(id);
        if (c.getStatus() != StatusConta.ABERTA) throw erro(HttpStatus.CONFLICT, "Só é possível editar contas em aberto");
        if (c.getPedidoCompra() != null && c.getValor().compareTo(r.valor()) != 0) {
            throw erro(HttpStatus.CONFLICT, "O valor de uma parcela de compra não pode ser alterado");
        }
        validarCategoria(c.getTipo(), r.categoria());
        c.setDescricao(r.descricao().trim());
        c.setCategoria(c.getPedidoCompra() != null ? CategoriaConta.FORNECEDOR : r.categoria());
        c.setFornecedor(c.getPedidoCompra() != null ? c.getFornecedor() : fornecedor(r.fornecedorId()));
        c.setValor(r.valor().setScale(2, RoundingMode.HALF_UP));
        c.setVencimento(r.vencimento());
        c.setObservacao(vazioParaNulo(r.observacao()));
        return Response.de(c);
    }

    /** Registra o pagamento (contas a pagar) ou o recebimento (contas a receber). */
    @Transactional
    public Response baixar(Long id, Baixa b, String email) {
        Conta c = travar(id);
        if (c.getStatus() != StatusConta.ABERTA) throw erro(HttpStatus.CONFLICT, "Esta conta não está em aberto");
        LocalDate data = b.pagoEm() == null ? LocalDate.now(ZONA) : b.pagoEm();
        if (data.isAfter(LocalDate.now(ZONA))) throw erro(HttpStatus.BAD_REQUEST, "A data do pagamento não pode estar no futuro");
        c.setStatus(StatusConta.PAGA);
        c.setPagoEm(data);
        c.setValorPago(b.valorPago() == null ? c.getValor() : b.valorPago().setScale(2, RoundingMode.HALF_UP));
        c.setFormaPagamento(b.forma());
        c.setBaixadoPor(usuario(email));
        c.setBaixadoEm(Instant.now());
        return Response.de(c);
    }

    /** Desfaz uma baixa feita por engano. */
    @Transactional
    public Response estornarBaixa(Long id) {
        Conta c = travar(id);
        if (c.getStatus() != StatusConta.PAGA) throw erro(HttpStatus.CONFLICT, "Esta conta não está paga");
        c.setStatus(StatusConta.ABERTA);
        c.setPagoEm(null);
        c.setValorPago(null);
        c.setFormaPagamento(null);
        c.setBaixadoPor(null);
        c.setBaixadoEm(null);
        return Response.de(c);
    }

    @Transactional
    public Response cancelar(Long id, String motivo, String email) {
        Conta c = travar(id);
        if (c.getStatus() != StatusConta.ABERTA) throw erro(HttpStatus.CONFLICT, "Só é possível cancelar contas em aberto");
        c.setStatus(StatusConta.CANCELADA);
        c.setCanceladoPor(usuario(email));
        c.setCanceladoEm(Instant.now());
        c.setMotivoCancelamento(motivo.trim());
        return Response.de(c);
    }

    @Transactional(readOnly = true)
    public Pagina<Response> listar(TipoConta tipo, StatusConta status, LocalDate de, LocalDate ate,
                                   String busca, int pagina, int tamanho) {
        LocalDate hoje = LocalDate.now(ZONA);
        Specification<Conta> spec = (root, q, cb) -> cb.conjunction();
        if (tipo != null) spec = spec.and((root, q, cb) -> cb.equal(root.get("tipo"), tipo));
        if (status == StatusConta.VENCIDA) {
            spec = spec.and((root, q, cb) -> cb.and(cb.equal(root.get("status"), StatusConta.ABERTA),
                    cb.lessThan(root.get("vencimento"), hoje)));
        } else if (status != null) {
            spec = spec.and((root, q, cb) -> cb.equal(root.get("status"), status));
        }
        // Para contas pagas o período se refere à data de pagamento; para as demais, ao vencimento.
        String campoData = status == StatusConta.PAGA ? "pagoEm" : "vencimento";
        if (de != null) spec = spec.and((root, q, cb) -> cb.greaterThanOrEqualTo(root.get(campoData), de));
        if (ate != null) spec = spec.and((root, q, cb) -> cb.lessThanOrEqualTo(root.get(campoData), ate));
        if (busca != null && !busca.isBlank()) {
            String termo = "%" + busca.trim().toLowerCase() + "%";
            spec = spec.and((root, q, cb) -> {
                var forn = root.join("fornecedor", jakarta.persistence.criteria.JoinType.LEFT);
                return cb.or(cb.like(cb.lower(root.get("descricao")), termo),
                        cb.like(cb.lower(forn.get("razaoSocial")), termo));
            });
        }
        Sort ordem = status == StatusConta.PAGA
                ? Sort.by(Sort.Direction.DESC, "pagoEm", "id")
                : Sort.by(Sort.Direction.ASC, "vencimento", "id");
        var pageable = PageRequest.of(Math.max(pagina, 0), Math.min(Math.max(tamanho, 1), 100), ordem);
        return Pagina.de(repo.findAll(spec, pageable), Response::de);
    }

    @Transactional(readOnly = true)
    public Response buscar(Long id) {
        return Response.de(repo.findById(id).orElseThrow(() -> erro(HttpStatus.NOT_FOUND, "Conta não encontrada")));
    }

    @Transactional(readOnly = true)
    public List<Response> doPedido(Long pedidoId) {
        return repo.findByPedidoCompraIdOrderByVencimentoAsc(pedidoId).stream().map(Response::de).toList();
    }

    @Transactional(readOnly = true)
    public Resumo resumo() {
        LocalDate hoje = LocalDate.now(ZONA);
        LocalDate passado = LocalDate.of(1900, 1, 1);
        LocalDate inicioMes = hoje.withDayOfMonth(1);
        return new Resumo(
                totais(TipoConta.PAGAR, passado, hoje.minusDays(1)),
                totais(TipoConta.PAGAR, hoje, hoje),
                totais(TipoConta.PAGAR, hoje, hoje.plusDays(7)),
                totais(TipoConta.RECEBER, passado, hoje.minusDays(1)),
                totais(TipoConta.RECEBER, hoje, hoje.plusDays(7)),
                repo.somaPagas(TipoConta.PAGAR, inicioMes, hoje),
                repo.somaPagas(TipoConta.RECEBER, inicioMes, hoje));
    }

    /**
     * Fluxo de caixa realizado, dia a dia: entradas = vendas concluídas + contas a receber pagas;
     * saídas = contas a pagar pagas.
     */
    @Transactional(readOnly = true)
    public Fluxo fluxo(LocalDate de, LocalDate ate) {
        if (ate.isBefore(de)) throw erro(HttpStatus.BAD_REQUEST, "A data final deve ser posterior à inicial");
        if (ChronoUnit.DAYS.between(de, ate) > 366) throw erro(HttpStatus.BAD_REQUEST, "Período máximo de 1 ano");
        var params = new MapSqlParameterSource()
                .addValue("ini", de.atStartOfDay(ZONA).toOffsetDateTime())
                .addValue("fim", ate.plusDays(1).atStartOfDay(ZONA).toOffsetDateTime())
                .addValue("de", de).addValue("ate", ate);

        Map<LocalDate, BigDecimal[]> dias = new TreeMap<>();
        for (LocalDate d = de; !d.isAfter(ate); d = d.plusDays(1)) {
            dias.put(d, new BigDecimal[]{BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO});
        }
        jdbc.query("""
                select (criado_em at time zone 'America/Sao_Paulo')::date as dia, sum(total) as valor
                from vendas where status = 'CONCLUIDA' and criado_em >= :ini and criado_em < :fim
                group by 1
                """, params, rs -> {
            dias.get(rs.getObject("dia", LocalDate.class))[0] = rs.getBigDecimal("valor");
        });
        jdbc.query("""
                select pago_em as dia, tipo, sum(valor_pago) as valor
                from contas where status = 'PAGA' and pago_em between :de and :ate
                group by 1, 2
                """, params, rs -> {
            BigDecimal[] v = dias.get(rs.getObject("dia", LocalDate.class));
            if ("RECEBER".equals(rs.getString("tipo"))) v[1] = rs.getBigDecimal("valor");
            else v[2] = rs.getBigDecimal("valor");
        });

        List<DiaFluxo> lista = new ArrayList<>();
        BigDecimal acumulado = BigDecimal.ZERO, tv = BigDecimal.ZERO, to = BigDecimal.ZERO, ts = BigDecimal.ZERO;
        for (var e : dias.entrySet()) {
            BigDecimal[] v = e.getValue();
            BigDecimal saldo = v[0].add(v[1]).subtract(v[2]);
            acumulado = acumulado.add(saldo);
            tv = tv.add(v[0]); to = to.add(v[1]); ts = ts.add(v[2]);
            lista.add(new DiaFluxo(e.getKey(), v[0], v[1], v[2], saldo, acumulado));
        }
        return new Fluxo(de, ate, tv, to, ts, tv.add(to).subtract(ts), lista,
                totais(TipoConta.PAGAR, de, ate), totais(TipoConta.RECEBER, de, ate));
    }

    // ---- utilitários ----

    private Totais totais(TipoConta tipo, LocalDate de, LocalDate ate) {
        Object[] r = repo.totaisAbertas(tipo, de, ate).get(0);
        return new Totais(((Number) r[0]).longValue(), (BigDecimal) r[1]);
    }

    private static void validarCategoria(TipoConta tipo, CategoriaConta cat) {
        if (tipo == TipoConta.RECEBER && cat != CategoriaConta.RECEITA_DIVERSA && cat != CategoriaConta.OUTROS) {
            throw erro(HttpStatus.BAD_REQUEST, "Contas a receber usam a categoria Receita diversa ou Outros");
        }
        if (tipo == TipoConta.PAGAR && cat == CategoriaConta.RECEITA_DIVERSA) {
            throw erro(HttpStatus.BAD_REQUEST, "Receita diversa só vale para contas a receber");
        }
    }

    private Fornecedor fornecedor(Long id) {
        if (id == null) return null;
        return fornecedores.findById(id).orElseThrow(() -> erro(HttpStatus.BAD_REQUEST, "Fornecedor não encontrado"));
    }

    private Conta travar(Long id) {
        return repo.buscarParaAtualizar(id).orElseThrow(() -> erro(HttpStatus.NOT_FOUND, "Conta não encontrada"));
    }

    private Usuario usuario(String email) { return usuarios.findByEmailIgnoreCase(email).orElseThrow(); }

    private static String vazioParaNulo(String s) { return s == null || s.isBlank() ? null : s.trim(); }

    private static ResponseStatusException erro(HttpStatus s, String msg) { return new ResponseStatusException(s, msg); }
}
