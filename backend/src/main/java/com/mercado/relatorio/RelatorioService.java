package com.mercado.relatorio;

import com.mercado.financeiro.CategoriaConta;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.time.temporal.TemporalAdjusters;
import java.util.*;

/**
 * Relatórios gerenciais. Consideram só vendas CONCLUÍDAS (canceladas aparecem à parte).
 * Os valores por item são anteriores ao desconto da venda; por isso o faturamento por
 * produto/categoria pode somar um pouco mais que o faturamento líquido do período.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class RelatorioService {
    static final ZoneId ZONA = ZoneId.of("America/Sao_Paulo");
    private static final BigDecimal CEM = BigDecimal.valueOf(100);

    public enum Agrupamento {
        DIA("day"), SEMANA("week"), MES("month");
        final String sql;
        Agrupamento(String sql) { this.sql = sql; }
    }

    public record PontoVendas(LocalDate periodo, long quantidade, BigDecimal faturamento, BigDecimal descontos,
                              BigDecimal custo, BigDecimal lucroBruto, BigDecimal ticketMedio,
                              long canceladas, BigDecimal valorCancelado) {}
    public record Vendas(LocalDate de, LocalDate ate, Agrupamento agrupamento, long quantidade,
                         BigDecimal faturamento, BigDecimal descontos, BigDecimal custo, BigDecimal lucroBruto,
                         BigDecimal margemBruta, BigDecimal ticketMedio, long canceladas, BigDecimal valorCancelado,
                         List<PontoVendas> serie) {}

    public record ProdutoAbc(Long produtoId, String codigoBarras, String nome, String unidade, String categoria,
                             BigDecimal quantidade, BigDecimal faturamento, BigDecimal custo, BigDecimal lucro,
                             BigDecimal margem, BigDecimal participacao, BigDecimal acumulado, String classe) {}
    public record CurvaAbc(BigDecimal faturamento, BigDecimal lucro, Map<String, Long> produtosPorClasse,
                           List<ProdutoAbc> itens) {}

    public record Grupo(String nome, long vendas, BigDecimal quantidade, BigDecimal faturamento, BigDecimal custo,
                        BigDecimal lucro, BigDecimal margem, BigDecimal participacao) {}

    public record Operador(Long usuarioId, String nome, long vendas, BigDecimal faturamento, BigDecimal ticketMedio,
                           BigDecimal descontos, long canceladas, BigDecimal valorCancelado) {}

    public record Pagamento(String forma, long vendas, BigDecimal valor, BigDecimal participacao) {}

    public record Horario(int diaSemana, int hora, long vendas, BigDecimal faturamento) {}

    public record LinhaDre(String categoria, BigDecimal valor) {}
    public record Dre(LocalDate de, LocalDate ate, BigDecimal receitaBruta, BigDecimal descontos,
                      BigDecimal receitaLiquida, BigDecimal cmv, BigDecimal lucroBruto, BigDecimal margemBruta,
                      List<LinhaDre> despesas, BigDecimal totalDespesas, BigDecimal outrasReceitas,
                      BigDecimal resultado, BigDecimal margemLiquida, BigDecimal comprasMercadoriaPagas) {}

    private final NamedParameterJdbcTemplate jdbc;

    public Vendas vendas(LocalDate de, LocalDate ate, Agrupamento ag) {
        var p = params(de, ate).addValue("g", ag.sql);
        Map<LocalDate, PontoVendas> pontos = new TreeMap<>();
        // Preenche os períodos sem venda para o gráfico não "pular" dias.
        for (LocalDate d = inicioPeriodo(de, ag); !d.isAfter(ate); d = proximo(d, ag)) {
            pontos.put(d, new PontoVendas(d, 0, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO,
                    BigDecimal.ZERO, BigDecimal.ZERO, 0, BigDecimal.ZERO));
        }
        Map<LocalDate, BigDecimal> custos = new HashMap<>();
        jdbc.query("""
                select date_trunc(:g, v.criado_em at time zone 'America/Sao_Paulo')::date as periodo,
                       sum(round(vi.quantidade * vi.custo_unitario, 2)) as custo
                from venda_itens vi join vendas v on v.id = vi.venda_id
                where v.status = 'CONCLUIDA' and v.criado_em >= :ini and v.criado_em < :fim
                group by 1
                """, p, rs -> { custos.put(rs.getObject("periodo", LocalDate.class), rs.getBigDecimal("custo")); });
        jdbc.query("""
                select date_trunc(:g, criado_em at time zone 'America/Sao_Paulo')::date as periodo,
                       count(*) filter (where status = 'CONCLUIDA') as qtd,
                       coalesce(sum(total) filter (where status = 'CONCLUIDA'), 0) as fat,
                       coalesce(sum(desconto) filter (where status = 'CONCLUIDA'), 0) as descontos,
                       count(*) filter (where status = 'CANCELADA') as canceladas,
                       coalesce(sum(total) filter (where status = 'CANCELADA'), 0) as cancelado
                from vendas where criado_em >= :ini and criado_em < :fim
                group by 1
                """, p, rs -> {
            LocalDate d = rs.getObject("periodo", LocalDate.class);
            long q = rs.getLong("qtd");
            BigDecimal fat = rs.getBigDecimal("fat");
            BigDecimal custo = custos.getOrDefault(d, BigDecimal.ZERO);
            pontos.put(d, new PontoVendas(d, q, fat, rs.getBigDecimal("descontos"), custo, fat.subtract(custo),
                    divide(fat, q), rs.getLong("canceladas"), rs.getBigDecimal("cancelado")));
        });

        List<PontoVendas> serie = new ArrayList<>(pontos.values());
        long q = 0, canc = 0;
        BigDecimal fat = BigDecimal.ZERO, desc = BigDecimal.ZERO, custo = BigDecimal.ZERO, vc = BigDecimal.ZERO;
        for (PontoVendas pv : serie) {
            q += pv.quantidade(); canc += pv.canceladas();
            fat = fat.add(pv.faturamento()); desc = desc.add(pv.descontos());
            custo = custo.add(pv.custo()); vc = vc.add(pv.valorCancelado());
        }
        BigDecimal lucro = fat.subtract(custo);
        return new Vendas(de, ate, ag, q, fat, desc, custo, lucro, pct(lucro, fat), divide(fat, q), canc, vc, serie);
    }

    public CurvaAbc curvaAbc(LocalDate de, LocalDate ate) {
        List<Object[]> linhas = jdbc.query("""
                select vi.produto_id, max(vi.codigo_barras) as codigo, max(vi.nome) as nome, max(vi.unidade) as unidade,
                       max(c.nome) as categoria, sum(vi.quantidade) as qtd, sum(vi.total) as fat,
                       sum(round(vi.quantidade * vi.custo_unitario, 2)) as custo
                from venda_itens vi
                join vendas v on v.id = vi.venda_id
                join produtos p on p.id = vi.produto_id
                join categorias c on c.id = p.categoria_id
                where v.status = 'CONCLUIDA' and v.criado_em >= :ini and v.criado_em < :fim
                group by vi.produto_id
                order by fat desc, nome
                """, params(de, ate), (rs, i) -> new Object[]{
                rs.getLong("produto_id"), rs.getString("codigo"), rs.getString("nome"), rs.getString("unidade"),
                rs.getString("categoria"), rs.getBigDecimal("qtd"), rs.getBigDecimal("fat"), rs.getBigDecimal("custo")});

        BigDecimal total = linhas.stream().map(l -> (BigDecimal) l[6]).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal lucroTotal = BigDecimal.ZERO, acumulado = BigDecimal.ZERO;
        Map<String, Long> porClasse = new LinkedHashMap<>(Map.of("A", 0L, "B", 0L, "C", 0L));
        List<ProdutoAbc> itens = new ArrayList<>();
        for (Object[] l : linhas) {
            BigDecimal fat = (BigDecimal) l[6], custo = (BigDecimal) l[7], lucro = fat.subtract(custo);
            BigDecimal part = pct(fat, total);
            // A classe é definida pelo acumulado ANTES do item: o item que cruza 80% ainda é A.
            String classe = acumulado.compareTo(BigDecimal.valueOf(80)) < 0 ? "A"
                    : acumulado.compareTo(BigDecimal.valueOf(95)) < 0 ? "B" : "C";
            acumulado = acumulado.add(part);
            porClasse.merge(classe, 1L, Long::sum);
            lucroTotal = lucroTotal.add(lucro);
            itens.add(new ProdutoAbc((Long) l[0], (String) l[1], (String) l[2], (String) l[3], (String) l[4],
                    (BigDecimal) l[5], fat, custo, lucro, pct(lucro, fat), part, acumulado.min(CEM), classe));
        }
        return new CurvaAbc(total, lucroTotal, porClasse, itens);
    }

    public List<Grupo> categorias(LocalDate de, LocalDate ate) {
        List<Grupo> brutos = jdbc.query("""
                select c.nome, count(distinct v.id) as vendas, sum(vi.quantidade) as qtd, sum(vi.total) as fat,
                       sum(round(vi.quantidade * vi.custo_unitario, 2)) as custo
                from venda_itens vi
                join vendas v on v.id = vi.venda_id
                join produtos p on p.id = vi.produto_id
                join categorias c on c.id = p.categoria_id
                where v.status = 'CONCLUIDA' and v.criado_em >= :ini and v.criado_em < :fim
                group by c.nome
                order by fat desc
                """, params(de, ate), (rs, i) -> {
            BigDecimal fat = rs.getBigDecimal("fat"), custo = rs.getBigDecimal("custo");
            return new Grupo(rs.getString("nome"), rs.getLong("vendas"), rs.getBigDecimal("qtd"), fat, custo,
                    fat.subtract(custo), pct(fat.subtract(custo), fat), null);
        });
        BigDecimal total = brutos.stream().map(Grupo::faturamento).reduce(BigDecimal.ZERO, BigDecimal::add);
        return brutos.stream().map(g -> new Grupo(g.nome(), g.vendas(), g.quantidade(), g.faturamento(), g.custo(),
                g.lucro(), g.margem(), pct(g.faturamento(), total))).toList();
    }

    public List<Operador> operadores(LocalDate de, LocalDate ate) {
        return jdbc.query("""
                select u.id, u.nome,
                       count(*) filter (where v.status = 'CONCLUIDA') as qtd,
                       coalesce(sum(v.total) filter (where v.status = 'CONCLUIDA'), 0) as fat,
                       coalesce(sum(v.desconto) filter (where v.status = 'CONCLUIDA'), 0) as descontos,
                       count(*) filter (where v.status = 'CANCELADA') as canceladas,
                       coalesce(sum(v.total) filter (where v.status = 'CANCELADA'), 0) as cancelado
                from vendas v join usuarios u on u.id = v.usuario_id
                where v.criado_em >= :ini and v.criado_em < :fim
                group by u.id, u.nome
                order by fat desc
                """, params(de, ate), (rs, i) -> {
            long q = rs.getLong("qtd");
            BigDecimal fat = rs.getBigDecimal("fat");
            return new Operador(rs.getLong("id"), rs.getString("nome"), q, fat, divide(fat, q),
                    rs.getBigDecimal("descontos"), rs.getLong("canceladas"), rs.getBigDecimal("cancelado"));
        });
    }

    /** Valor recebido por forma de pagamento. O troco é descontado do dinheiro. */
    public List<Pagamento> pagamentos(LocalDate de, LocalDate ate) {
        var p = params(de, ate);
        BigDecimal troco = jdbc.queryForObject("""
                select coalesce(sum(troco), 0) from vendas
                where status = 'CONCLUIDA' and criado_em >= :ini and criado_em < :fim
                """, p, BigDecimal.class);
        List<Pagamento> brutos = jdbc.query("""
                select vp.forma, count(distinct v.id) as vendas, sum(vp.valor) as valor
                from venda_pagamentos vp join vendas v on v.id = vp.venda_id
                where v.status = 'CONCLUIDA' and v.criado_em >= :ini and v.criado_em < :fim
                group by vp.forma
                """, p, (rs, i) -> {
            String forma = rs.getString("forma");
            BigDecimal valor = rs.getBigDecimal("valor");
            if ("DINHEIRO".equals(forma)) valor = valor.subtract(troco);
            return new Pagamento(forma, rs.getLong("vendas"), valor, null);
        });
        BigDecimal total = brutos.stream().map(Pagamento::valor).reduce(BigDecimal.ZERO, BigDecimal::add);
        return brutos.stream()
                .map(x -> new Pagamento(x.forma(), x.vendas(), x.valor(), pct(x.valor(), total)))
                .sorted(Comparator.comparing(Pagamento::valor).reversed()).toList();
    }

    /** Mapa de calor: dia da semana (1 = segunda … 7 = domingo) × hora. */
    public List<Horario> horarios(LocalDate de, LocalDate ate) {
        return jdbc.query("""
                select extract(isodow from criado_em at time zone 'America/Sao_Paulo')::int as dia,
                       extract(hour from criado_em at time zone 'America/Sao_Paulo')::int as hora,
                       count(*) as qtd, sum(total) as fat
                from vendas where status = 'CONCLUIDA' and criado_em >= :ini and criado_em < :fim
                group by 1, 2 order by 1, 2
                """, params(de, ate), (rs, i) -> new Horario(rs.getInt("dia"), rs.getInt("hora"),
                rs.getLong("qtd"), rs.getBigDecimal("fat")));
    }

    /**
     * DRE gerencial simplificada (regime de caixa para despesas).
     * Compras de mercadoria não entram como despesa: o custo delas aparece no CMV quando o produto é vendido.
     */
    public Dre dre(LocalDate de, LocalDate ate) {
        var p = params(de, ate);
        Map<String, Object> v = jdbc.queryForMap("""
                select coalesce(sum(subtotal), 0) as bruta, coalesce(sum(desconto), 0) as descontos
                from vendas where status = 'CONCLUIDA' and criado_em >= :ini and criado_em < :fim
                """, p);
        BigDecimal cmv = jdbc.queryForObject("""
                select coalesce(sum(round(vi.quantidade * vi.custo_unitario, 2)), 0)
                from venda_itens vi join vendas v on v.id = vi.venda_id
                where v.status = 'CONCLUIDA' and v.criado_em >= :ini and v.criado_em < :fim
                """, p, BigDecimal.class);
        List<LinhaDre> despesas = jdbc.query("""
                select categoria, sum(valor_pago) as valor from contas
                where tipo = 'PAGAR' and status = 'PAGA' and pago_em between :de and :ate and categoria <> 'FORNECEDOR'
                group by categoria order by valor desc
                """, p, (rs, i) -> new LinhaDre(rs.getString("categoria"), rs.getBigDecimal("valor")));
        BigDecimal outras = jdbc.queryForObject("""
                select coalesce(sum(valor_pago), 0) from contas
                where tipo = 'RECEBER' and status = 'PAGA' and pago_em between :de and :ate
                """, p, BigDecimal.class);
        BigDecimal compras = jdbc.queryForObject("""
                select coalesce(sum(valor_pago), 0) from contas
                where tipo = 'PAGAR' and status = 'PAGA' and pago_em between :de and :ate and categoria = :forn
                """, p.addValue("forn", CategoriaConta.FORNECEDOR.name()), BigDecimal.class);

        BigDecimal bruta = (BigDecimal) v.get("bruta"), descontos = (BigDecimal) v.get("descontos");
        BigDecimal liquida = bruta.subtract(descontos);
        BigDecimal lucroBruto = liquida.subtract(cmv);
        BigDecimal totalDesp = despesas.stream().map(LinhaDre::valor).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal resultado = lucroBruto.subtract(totalDesp).add(outras);
        return new Dre(de, ate, bruta, descontos, liquida, cmv, lucroBruto, pct(lucroBruto, liquida),
                despesas, totalDesp, outras, resultado, pct(resultado, liquida.add(outras)), compras);
    }

    // ---- utilitários ----

    static MapSqlParameterSource params(LocalDate de, LocalDate ate) {
        if (de == null || ate == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe o período");
        if (ate.isBefore(de)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A data final deve ser posterior à inicial");
        if (ChronoUnit.DAYS.between(de, ate) > 731) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Período máximo de 2 anos");
        return new MapSqlParameterSource()
                .addValue("ini", de.atStartOfDay(ZONA).toOffsetDateTime())
                .addValue("fim", ate.plusDays(1).atStartOfDay(ZONA).toOffsetDateTime())
                .addValue("de", de).addValue("ate", ate);
    }

    private static LocalDate inicioPeriodo(LocalDate d, Agrupamento ag) {
        return switch (ag) {
            case DIA -> d;
            case SEMANA -> d.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
            case MES -> d.withDayOfMonth(1);
        };
    }

    private static LocalDate proximo(LocalDate d, Agrupamento ag) {
        return switch (ag) {
            case DIA -> d.plusDays(1);
            case SEMANA -> d.plusWeeks(1);
            case MES -> d.plusMonths(1);
        };
    }

    static BigDecimal pct(BigDecimal parte, BigDecimal total) {
        if (total == null || total.signum() == 0) return BigDecimal.ZERO;
        return parte.multiply(CEM).divide(total, 2, RoundingMode.HALF_UP);
    }

    static BigDecimal divide(BigDecimal v, long q) {
        return q == 0 ? BigDecimal.ZERO : v.divide(BigDecimal.valueOf(q), 2, RoundingMode.HALF_UP);
    }
}
