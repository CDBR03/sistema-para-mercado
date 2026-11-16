import { useEffect, useState } from 'react'
import { mensagemErro, relatoriosApi } from '../api/recursos'
import { Colunas, Indicador, MapaCalor, Ranking } from '../components/Graficos'
import { SeletorPeriodo } from './Financeiro'
import { CATEGORIAS_CONTA, FORMAS, baixarCsv, dataBr, moeda, numero, pct, periodoPreset } from '../utils'

const ABAS = [
  ['vendas', 'Vendas'], ['abc', 'Produtos (curva ABC)'], ['categorias', 'Categorias'],
  ['operadores', 'Operadores'], ['pagamentos', 'Formas de pagamento'], ['horarios', 'Horários'], ['dre', 'Resultado (DRE)'],
]

export default function Relatorios() {
  const [aba, setAbaEstado] = useState(() => {
    const h = window.location.hash.slice(1)
    return ABAS.some(([id]) => id === h) ? h : 'vendas'
  })
  const setAba = (id) => { setAbaEstado(id); window.history.replaceState(null, '', `#${id}`) }
  const [[de, ate], setPeriodo] = useState(() => periodoPreset('mes'))
  const [agrup, setAgrup] = useState('DIA')
  const [dados, setDados] = useState(null)
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)

  useEffect(() => {
    if (!de || !ate) return
    let vivo = true
    setErro(''); setCarregando(true); setDados(null)
    const chamadas = {
      vendas: () => relatoriosApi.vendas({ de, ate, agrupamento: agrup }),
      abc: () => relatoriosApi.curvaAbc({ de, ate }),
      categorias: () => relatoriosApi.categorias({ de, ate }),
      operadores: () => relatoriosApi.operadores({ de, ate }),
      pagamentos: () => relatoriosApi.pagamentos({ de, ate }),
      horarios: () => relatoriosApi.horarios({ de, ate }),
      dre: () => relatoriosApi.dre({ de, ate }),
    }
    chamadas[aba]()
      .then((d) => vivo && setDados(d))
      .catch((e) => vivo && setErro(mensagemErro(e)))
      .finally(() => vivo && setCarregando(false))
    return () => { vivo = false }
  }, [aba, de, ate, agrup])

  const nomeArq = (s) => `${s}-${de}-a-${ate}`
  const exportar = EXPORTS[aba] && dados ? () => EXPORTS[aba](dados, nomeArq(aba)) : null

  return (
    <>
      <h2>Relatórios</h2>
      <div className="abas rolavel" role="tablist">
        {ABAS.map(([id, nome]) => (
          <button key={id} role="tab" aria-selected={aba === id} className={aba === id ? 'ativa' : ''} onClick={() => setAba(id)}>{nome}</button>
        ))}
      </div>
      <SeletorPeriodo de={de} ate={ate} onMudar={setPeriodo}>
        {aba === 'vendas' && (
          <select aria-label="Agrupar por" value={agrup} onChange={(e) => setAgrup(e.target.value)}>
            <option value="DIA">Por dia</option><option value="SEMANA">Por semana</option><option value="MES">Por mês</option>
          </select>
        )}
        <button className="sec" onClick={exportar ?? undefined} disabled={!exportar}>Exportar CSV</button>
        <button className="sec" onClick={() => window.print()} disabled={!dados}>Imprimir</button>
      </SeletorPeriodo>
      <p className="muted so-impressao">Período: {dataBr(de)} a {dataBr(ate)}</p>

      {erro && <p className="erro" role="alert">{erro}</p>}
      {carregando && <p className="muted">Carregando…</p>}
      {dados && (
        <div className="relatorio">
          {aba === 'vendas' && <RelVendas d={dados} />}
          {aba === 'abc' && <RelAbc d={dados} />}
          {aba === 'categorias' && <RelCategorias d={dados} />}
          {aba === 'operadores' && <RelOperadores d={dados} />}
          {aba === 'pagamentos' && <RelPagamentos d={dados} />}
          {aba === 'horarios' && <MapaCalor dados={dados} formatar={moeda} />}
          {aba === 'dre' && <RelDre d={dados} />}
        </div>
      )}
    </>
  )
}

const rotuloPeriodo = (iso, ag) => {
  if (ag === 'MES') return new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })
  if (ag === 'SEMANA') return `sem. ${dataBr(iso).slice(0, 5)}`
  return dataBr(iso).slice(0, 5)
}

function RelVendas({ d }) {
  const n = d.serie.length
  return (
    <>
      <div className="indicadores">
        <Indicador rotulo="Faturamento" valor={moeda(d.faturamento)} destaque />
        <Indicador rotulo="Vendas" valor={numero(d.quantidade)} />
        <Indicador rotulo="Ticket médio" valor={moeda(d.ticketMedio)} />
        <Indicador rotulo="Lucro bruto" valor={moeda(d.lucroBruto)} />
        <Indicador rotulo="Margem bruta" valor={pct(d.margemBruta)} />
        <Indicador rotulo="Descontos" valor={moeda(d.descontos)} />
        <Indicador rotulo="Canceladas" valor={`${d.canceladas} · ${moeda(d.valorCancelado)}`} />
      </div>
      <section className="painel">
        <h3>Faturamento {d.agrupamento === 'DIA' ? 'por dia' : d.agrupamento === 'SEMANA' ? 'por semana' : 'por mês'}</h3>
        <Colunas titulo="Faturamento no período" formatar={moeda} marcarCada={Math.ceil(n / 15)}
                 dados={d.serie.map((p) => ({
                   rotulo: d.agrupamento === 'DIA' ? dataBr(p.periodo) : rotuloPeriodo(p.periodo, d.agrupamento),
                   eixo: rotuloPeriodo(p.periodo, d.agrupamento), valor: p.faturamento,
                   detalhe: [['Vendas', p.quantidade], ['Ticket médio', moeda(p.ticketMedio)], ['Lucro bruto', moeda(p.lucroBruto)]],
                 }))}
                 rotuloEixo={(x) => x.eixo} />
      </section>
      <div className="rolagem">
        <table className="tabela">
          <thead><tr><th>Período</th><th>Vendas</th><th>Faturamento</th><th>Ticket médio</th><th>Descontos</th><th>Custo (CMV)</th><th>Lucro bruto</th><th>Canceladas</th></tr></thead>
          <tbody>
            {d.serie.filter((p) => p.quantidade || p.canceladas).map((p) => (
              <tr key={p.periodo}>
                <td className="num">{rotuloPeriodo(p.periodo, d.agrupamento)}{d.agrupamento === 'DIA' && `/${p.periodo.slice(0, 4)}`}</td>
                <td className="num">{p.quantidade}</td>
                <td className="num">{moeda(p.faturamento)}</td>
                <td className="num">{moeda(p.ticketMedio)}</td>
                <td className="num">{moeda(p.descontos)}</td>
                <td className="num">{moeda(p.custo)}</td>
                <td className="num">{moeda(p.lucroBruto)}</td>
                <td className="num">{p.canceladas ? `${p.canceladas} · ${moeda(p.valorCancelado)}` : '—'}</td>
              </tr>
            ))}
            {d.quantidade === 0 && d.canceladas === 0 && <tr><td colSpan="8" className="vazio">Nenhuma venda no período.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  )
}

function RelAbc({ d }) {
  const [classe, setClasse] = useState('')
  const itens = classe ? d.itens.filter((i) => i.classe === classe) : d.itens
  return (
    <>
      <div className="indicadores">
        <Indicador rotulo="Faturamento dos itens" valor={moeda(d.faturamento)} destaque />
        <Indicador rotulo="Lucro bruto" valor={moeda(d.lucro)} />
        <Indicador rotulo="Classe A (80% do faturamento)" valor={`${d.produtosPorClasse.A} produtos`} />
        <Indicador rotulo="Classe B (15%)" valor={`${d.produtosPorClasse.B} produtos`} />
        <Indicador rotulo="Classe C (5%)" valor={`${d.produtosPorClasse.C} produtos`} />
      </div>
      <p className="muted">Classe A: poucos produtos que fazem a maior parte do faturamento. Nunca deixe faltar. Classe C: muitos itens de giro baixo, candidatos a revisar o mix.</p>
      <div className="filtros">
        <select aria-label="Filtrar classe" value={classe} onChange={(e) => setClasse(e.target.value)}>
          <option value="">Todas as classes</option><option value="A">Classe A</option><option value="B">Classe B</option><option value="C">Classe C</option>
        </select>
      </div>
      <div className="rolagem">
        <table className="tabela">
          <thead><tr><th>#</th><th>Produto</th><th>Categoria</th><th>Qtd. vendida</th><th>Faturamento</th><th>Lucro</th><th>Margem</th><th>Part.</th><th>Acum.</th><th>Classe</th></tr></thead>
          <tbody>
            {itens.map((i) => (
              <tr key={i.produtoId}>
                <td className="num">{d.itens.indexOf(i) + 1}</td>
                <td>{i.nome}<small className="sub">{i.codigoBarras}</small></td>
                <td>{i.categoria}</td>
                <td className="num">{numero(i.quantidade)} {i.unidade}</td>
                <td className="num">{moeda(i.faturamento)}</td>
                <td className={`num ${Number(i.lucro) < 0 ? 'neg' : ''}`}>{moeda(i.lucro)}</td>
                <td className="num">{pct(i.margem)}</td>
                <td className="num">{pct(i.participacao)}</td>
                <td className="num">{pct(i.acumulado)}</td>
                <td><span className={`selo classe-${i.classe}`}>{i.classe}</span></td>
              </tr>
            ))}
            {itens.length === 0 && <tr><td colSpan="10" className="vazio">Nenhum produto vendido no período.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  )
}

function RelCategorias({ d }) {
  return (
    <>
      <section className="painel">
        <h3>Faturamento por categoria</h3>
        <Ranking titulo="Faturamento por categoria" formatar={moeda}
                 dados={d.map((g) => ({ rotulo: g.nome, sub: `${pct(g.participacao)} do total · margem ${pct(g.margem)}`, valor: g.faturamento }))} />
      </section>
      <TabelaGrupos d={d} />
    </>
  )
}

function TabelaGrupos({ d }) {
  return (
    <div className="rolagem">
      <table className="tabela">
        <thead><tr><th>Categoria</th><th>Vendas</th><th>Faturamento</th><th>Custo</th><th>Lucro</th><th>Margem</th><th>Participação</th></tr></thead>
        <tbody>
          {d.map((g) => (
            <tr key={g.nome}>
              <td>{g.nome}</td><td className="num">{g.vendas}</td><td className="num">{moeda(g.faturamento)}</td>
              <td className="num">{moeda(g.custo)}</td><td className="num">{moeda(g.lucro)}</td>
              <td className="num">{pct(g.margem)}</td><td className="num">{pct(g.participacao)}</td>
            </tr>
          ))}
          {d.length === 0 && <tr><td colSpan="7" className="vazio">Nenhuma venda no período.</td></tr>}
        </tbody>
      </table>
    </div>
  )
}

function RelOperadores({ d }) {
  return (
    <>
      <section className="painel">
        <h3>Faturamento por operador</h3>
        <Ranking titulo="Faturamento por operador" formatar={moeda}
                 dados={d.map((o) => ({ rotulo: o.nome, sub: `${o.vendas} vendas · ticket ${moeda(o.ticketMedio)}`, valor: o.faturamento }))} />
      </section>
      <div className="rolagem">
        <table className="tabela">
          <thead><tr><th>Operador</th><th>Vendas</th><th>Faturamento</th><th>Ticket médio</th><th>Descontos dados</th><th>Canceladas</th></tr></thead>
          <tbody>
            {d.map((o) => (
              <tr key={o.usuarioId}>
                <td>{o.nome}</td><td className="num">{o.vendas}</td><td className="num">{moeda(o.faturamento)}</td>
                <td className="num">{moeda(o.ticketMedio)}</td><td className="num">{moeda(o.descontos)}</td>
                <td className="num">{o.canceladas ? `${o.canceladas} · ${moeda(o.valorCancelado)}` : '—'}</td>
              </tr>
            ))}
            {d.length === 0 && <tr><td colSpan="6" className="vazio">Nenhuma venda no período.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  )
}

function RelPagamentos({ d }) {
  return (
    <>
      <section className="painel">
        <h3>Valor recebido por forma de pagamento</h3>
        <Ranking titulo="Valor por forma de pagamento" formatar={moeda}
                 dados={d.map((p) => ({ rotulo: FORMAS[p.forma], sub: `${pct(p.participacao)} · ${p.vendas} vendas`, valor: p.valor }))} />
      </section>
      <p className="muted">O troco já está descontado do dinheiro. Uma venda paga com duas formas conta nas duas.</p>
    </>
  )
}

function RelDre({ d }) {
  const L = ({ rotulo, valor, nivel = 0, forte, sinal }) => (
    <tr className={forte ? 'forte' : ''}>
      <td style={{ paddingLeft: `${0.9 + nivel * 1.25}rem` }}>{rotulo}</td>
      <td className={`num ${Number(valor) < 0 ? 'neg' : ''}`}>{sinal && Number(valor) > 0 ? '− ' : ''}{moeda(valor)}</td>
    </tr>
  )
  return (
    <>
      <div className="indicadores">
        <Indicador rotulo="Receita líquida" valor={moeda(d.receitaLiquida)} />
        <Indicador rotulo="Lucro bruto" valor={moeda(d.lucroBruto)} />
        <Indicador rotulo="Margem bruta" valor={pct(d.margemBruta)} />
        <Indicador rotulo="Resultado" valor={moeda(d.resultado)} destaque negativo={Number(d.resultado) < 0} />
        <Indicador rotulo="Margem líquida" valor={pct(d.margemLiquida)} />
      </div>
      <div className="rolagem">
        <table className="tabela dre">
          <tbody>
            <L rotulo="Receita bruta de vendas" valor={d.receitaBruta} forte />
            <L rotulo="Descontos concedidos" valor={d.descontos} nivel={1} sinal />
            <L rotulo="Receita líquida" valor={d.receitaLiquida} forte />
            <L rotulo="Custo das mercadorias vendidas (CMV)" valor={d.cmv} nivel={1} sinal />
            <L rotulo="Lucro bruto" valor={d.lucroBruto} forte />
            <L rotulo="Despesas operacionais pagas" valor={d.totalDespesas} nivel={1} sinal />
            {d.despesas.map((x) => <L key={x.categoria} rotulo={CATEGORIAS_CONTA[x.categoria] ?? x.categoria} valor={x.valor} nivel={2} sinal />)}
            <L rotulo="Outras receitas recebidas" valor={d.outrasReceitas} nivel={1} />
            <L rotulo="Resultado do período" valor={d.resultado} forte />
          </tbody>
        </table>
      </div>
      <p className="muted">
        DRE gerencial simplificada. Despesas entram pela data do pagamento. Compras de mercadoria pagas no período
        ({moeda(d.comprasMercadoriaPagas)}) não são despesa: o custo delas entra no CMV quando o produto é vendido.
      </p>
    </>
  )
}

/* ---------------- Exportação CSV ---------------- */

const EXPORTS = {
  vendas: (d, nome) => baixarCsv(nome, [
    ['Período', (p) => dataBr(p.periodo)], ['Vendas', (p) => p.quantidade], ['Faturamento', (p) => Number(p.faturamento)],
    ['Ticket médio', (p) => Number(p.ticketMedio)], ['Descontos', (p) => Number(p.descontos)], ['CMV', (p) => Number(p.custo)],
    ['Lucro bruto', (p) => Number(p.lucroBruto)], ['Canceladas', (p) => p.canceladas], ['Valor cancelado', (p) => Number(p.valorCancelado)],
  ], d.serie),
  abc: (d, nome) => baixarCsv(nome, [
    ['Código', (i) => i.codigoBarras], ['Produto', (i) => i.nome], ['Categoria', (i) => i.categoria], ['Unidade', (i) => i.unidade],
    ['Quantidade', (i) => Number(i.quantidade)], ['Faturamento', (i) => Number(i.faturamento)], ['Custo', (i) => Number(i.custo)],
    ['Lucro', (i) => Number(i.lucro)], ['Margem %', (i) => Number(i.margem)], ['Participação %', (i) => Number(i.participacao)],
    ['Acumulado %', (i) => Number(i.acumulado)], ['Classe', (i) => i.classe],
  ], d.itens),
  categorias: (d, nome) => baixarCsv(nome, [
    ['Categoria', (g) => g.nome], ['Vendas', (g) => g.vendas], ['Faturamento', (g) => Number(g.faturamento)], ['Custo', (g) => Number(g.custo)],
    ['Lucro', (g) => Number(g.lucro)], ['Margem %', (g) => Number(g.margem)], ['Participação %', (g) => Number(g.participacao)],
  ], d),
  operadores: (d, nome) => baixarCsv(nome, [
    ['Operador', (o) => o.nome], ['Vendas', (o) => o.vendas], ['Faturamento', (o) => Number(o.faturamento)], ['Ticket médio', (o) => Number(o.ticketMedio)],
    ['Descontos', (o) => Number(o.descontos)], ['Canceladas', (o) => o.canceladas], ['Valor cancelado', (o) => Number(o.valorCancelado)],
  ], d),
  pagamentos: (d, nome) => baixarCsv(nome, [
    ['Forma', (p) => FORMAS[p.forma]], ['Vendas', (p) => p.vendas], ['Valor', (p) => Number(p.valor)], ['Participação %', (p) => Number(p.participacao)],
  ], d),
  horarios: (d, nome) => baixarCsv(nome, [
    ['Dia da semana', (h) => ['', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'][h.diaSemana]], ['Hora', (h) => h.hora],
    ['Vendas', (h) => h.vendas], ['Faturamento', (h) => Number(h.faturamento)],
  ], d),
  dre: (d, nome) => baixarCsv(nome, [['Linha', (l) => l[0]], ['Valor', (l) => Number(l[1])]], [
    ['Receita bruta', d.receitaBruta], ['(-) Descontos', d.descontos], ['Receita líquida', d.receitaLiquida], ['(-) CMV', d.cmv],
    ['Lucro bruto', d.lucroBruto], ['(-) Despesas operacionais', d.totalDespesas],
    ...d.despesas.map((x) => [`   ${CATEGORIAS_CONTA[x.categoria] ?? x.categoria}`, x.valor]),
    ['(+) Outras receitas', d.outrasReceitas], ['Resultado', d.resultado],
  ]),
}
