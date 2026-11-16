package com.mercado.relatorio;

import com.mercado.auth.Perfil;
import com.mercado.auth.Usuario;
import com.mercado.auth.UsuarioRepository;
import com.mercado.compra.CompraService;
import com.mercado.estoque.EstoqueService;
import com.mercado.financeiro.FinanceiroService;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class DashboardService {

    public record Kpi(long quantidade, BigDecimal faturamento, BigDecimal ticketMedio) {}
    public record Estoque(int estoqueBaixo, int vencidos, int vencendo) {}
    public record Gestao(LocalDate hoje, Kpi vendasHoje, Kpi vendasOntem, Kpi mesmoDiaSemanaPassada,
                         BigDecimal faturamentoMes, BigDecimal faturamentoMesAnteriorAteHoje,
                         BigDecimal lucroBrutoMes, BigDecimal margemBrutaMes,
                         List<RelatorioService.PontoVendas> ultimos30Dias,
                         long[] vendasPorHoraHoje,
                         List<RelatorioService.ProdutoAbc> topProdutosMes,
                         List<RelatorioService.Pagamento> pagamentosMes,
                         FinanceiroService.Resumo financeiro, Estoque estoque, long pedidosCompraAbertos) {}

    public record MeuDia(long minhasVendasHoje, BigDecimal meuFaturamentoHoje, Long pedidosCompraAbertos) {}

    private final RelatorioService relatorios;
    private final FinanceiroService financeiro;
    private final EstoqueService estoque;
    private final CompraService compras;
    private final UsuarioRepository usuarios;
    private final NamedParameterJdbcTemplate jdbc;

    public Gestao gestao() {
        LocalDate hoje = LocalDate.now(RelatorioService.ZONA);
        LocalDate inicioMes = hoje.withDayOfMonth(1);
        LocalDate mesAnteriorIni = inicioMes.minusMonths(1);
        // Compara com o mesmo intervalo do mês passado (ex.: dia 1 a 16 contra dia 1 a 16).
        LocalDate mesAnteriorFim = mesAnteriorIni.plusDays(
                Math.min(hoje.getDayOfMonth(), mesAnteriorIni.lengthOfMonth()) - 1);

        var mes = relatorios.vendas(inicioMes, hoje, RelatorioService.Agrupamento.MES);
        var mesAnterior = relatorios.vendas(mesAnteriorIni, mesAnteriorFim, RelatorioService.Agrupamento.MES);
        var trinta = relatorios.vendas(hoje.minusDays(29), hoje, RelatorioService.Agrupamento.DIA);

        long[] porHora = new long[24];
        jdbc.query("""
                select extract(hour from criado_em at time zone 'America/Sao_Paulo')::int as hora, count(*) as qtd
                from vendas where status = 'CONCLUIDA' and criado_em >= :ini and criado_em < :fim group by 1
                """, RelatorioService.params(hoje, hoje), rs -> { porHora[rs.getInt("hora")] = rs.getLong("qtd"); });

        List<RelatorioService.ProdutoAbc> top = relatorios.curvaAbc(inicioMes, hoje).itens();
        var alertas = estoque.alertas(7);
        return new Gestao(hoje, kpi(hoje), kpi(hoje.minusDays(1)), kpi(hoje.minusDays(7)),
                mes.faturamento(), mesAnterior.faturamento(), mes.lucroBruto(), mes.margemBruta(),
                trinta.serie(), porHora, top.subList(0, Math.min(5, top.size())),
                relatorios.pagamentos(inicioMes, hoje), financeiro.resumo(),
                new Estoque(alertas.estoqueBaixo().size(), alertas.vencidos().size(), alertas.vencendo().size()),
                compras.abertos());
    }

    /** Resumo pessoal para caixas e estoquistas. */
    public MeuDia meuDia(String email) {
        Usuario u = usuarios.findByEmailIgnoreCase(email).orElseThrow();
        LocalDate hoje = LocalDate.now(RelatorioService.ZONA);
        Map<String, Object> r = jdbc.queryForMap("""
                select count(*) as qtd, coalesce(sum(total), 0) as fat from vendas
                where status = 'CONCLUIDA' and usuario_id = :u and criado_em >= :ini and criado_em < :fim
                """, RelatorioService.params(hoje, hoje).addValue("u", u.getId()));
        boolean veCompras = u.getPerfil() != Perfil.CAIXA;
        return new MeuDia(((Number) r.get("qtd")).longValue(), (BigDecimal) r.get("fat"),
                veCompras ? compras.abertos() : null);
    }

    private Kpi kpi(LocalDate dia) {
        var v = relatorios.vendas(dia, dia, RelatorioService.Agrupamento.DIA);
        return new Kpi(v.quantidade(), v.faturamento(), v.ticketMedio());
    }
}
