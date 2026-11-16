import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { dashboardApi, estoqueApi } from '../api/recursos'
import { Colunas, Indicador, Ranking } from '../components/Graficos'
import { useAuth } from '../context/AuthContext'
import { MODULOS } from '../modulos'
import { FORMAS, dataBr, moeda, numero, pct, variacao } from '../utils'

const VE_ESTOQUE = ['ADMIN', 'GERENTE', 'ESTOQUISTA']
const GESTAO = ['ADMIN', 'GERENTE']

export default function Dashboard() {
  const { user } = useAuth()
  const gestor = GESTAO.includes(user.perfil)
  const [alertas, setAlertas] = useState(null)
  const visiveis = MODULOS.filter((m) => m.perfis.includes(user.perfil))

  useEffect(() => {
    if (VE_ESTOQUE.includes(user.perfil) && !gestor) estoqueApi.alertas(7).then(setAlertas).catch(() => {})
  }, [user.perfil, gestor])

  const partes = alertas && [
    [alertas.estoqueBaixo.length, 'com estoque baixo'],
    [alertas.vencidos.length, 'vencidos'],
    [alertas.vencendo.length, 'vencendo em 7 dias'],
  ].filter(([n]) => n > 0)

  return (
    <>
      <h2>Olá, {user.nome}</h2>
      {gestor ? <PainelGestao /> : (
        <>
          {partes?.length > 0 && (
            <p className="aviso" role="status">
              Atenção ao estoque: {partes.map(([n, t]) => `${n} ${n === 1 ? 'produto' : 'produtos'} ${t}`).join(', ')}.{' '}
              <Link to="/estoque">Ver alertas</Link>
            </p>
          )}
          <MeuDia perfil={user.perfil} />
        </>
      )}
      <h3 className="titulo-secao">Módulos</h3>
      <ul className="modulos">
        {visiveis.map((m) => (
          <li key={m.nome} className={m.caminho ? '' : 'indisponivel'}>
            {m.caminho ? <Link to={m.caminho}>{m.nome}</Link> : <>{m.nome}<small>em breve</small></>}
          </li>
        ))}
      </ul>
    </>
  )
}

function MeuDia({ perfil }) {
  const [d, setD] = useState(null)
  useEffect(() => { dashboardApi.meuDia().then(setD).catch(() => {}) }, [])
  if (!d) return null
  return (
    <div className="indicadores">
      {perfil === 'CAIXA' && <>
        <Indicador rotulo="Minhas vendas hoje" valor={d.minhasVendasHoje} />
        <Indicador rotulo="Meu faturamento hoje" valor={moeda(d.meuFaturamentoHoje)} destaque />
      </>}
      {d.pedidosCompraAbertos != null && (
        <Link to="/compras" className="indicador link">
          <span className="i-rotulo">Pedidos de compra aguardando recebimento</span>
          <strong className="i-valor">{d.pedidosCompraAbertos}</strong>
        </Link>
      )}
    </div>
  )
}

function PainelGestao() {
  const [d, setD] = useState(null)
  const [erro, setErro] = useState(false)
  useEffect(() => { dashboardApi.gestao().then(setD).catch(() => setErro(true)) }, [])

  if (erro) return <p className="erro">Não foi possível carregar os indicadores.</p>
  if (!d) return <p className="muted">Carregando indicadores…</p>

  const f = d.financeiro
  const e = d.estoque
  const pendencias = [
    f.pagarVencidas.quantidade > 0 && { to: '/financeiro', critico: true, texto: `${f.pagarVencidas.quantidade} ${f.pagarVencidas.quantidade === 1 ? 'conta vencida' : 'contas vencidas'} a pagar (${moeda(f.pagarVencidas.valor)})` },
    f.pagarHoje.quantidade > 0 && { to: '/financeiro', texto: `${f.pagarHoje.quantidade} ${f.pagarHoje.quantidade === 1 ? 'conta vence' : 'contas vencem'} hoje (${moeda(f.pagarHoje.valor)})` },
    e.vencidos > 0 && { to: '/estoque', critico: true, texto: `${e.vencidos} ${e.vencidos === 1 ? 'produto vencido' : 'produtos vencidos'} com saldo` },
    e.estoqueBaixo > 0 && { to: '/estoque', texto: `${e.estoqueBaixo} ${e.estoqueBaixo === 1 ? 'produto' : 'produtos'} com estoque baixo` },
    e.vencendo > 0 && { to: '/estoque', texto: `${e.vencendo} ${e.vencendo === 1 ? 'produto vence' : 'produtos vencem'} em 7 dias` },
    d.pedidosCompraAbertos > 0 && { to: '/compras', texto: `${d.pedidosCompraAbertos} ${d.pedidosCompraAbertos === 1 ? 'pedido de compra aguardando' : 'pedidos de compra aguardando'} entrega` },
    f.receberVencidas.quantidade > 0 && { to: '/financeiro', texto: `${f.receberVencidas.quantidade} ${f.receberVencidas.quantidade === 1 ? 'conta a receber atrasada' : 'contas a receber atrasadas'} (${moeda(f.receberVencidas.valor)})` },
  ].filter(Boolean)

  const horas = d.vendasPorHoraHoje.map((v, h) => ({ h, v })).filter(({ h }) => h >= 6 && h <= 23)
  const n30 = d.ultimos30Dias.length

  return (
    <>
      <p className="muted">Resumo de {dataBr(d.hoje)}.</p>
      <div className="indicadores">
        <Indicador rotulo="Faturamento hoje" valor={moeda(d.vendasHoje.faturamento)} destaque
                   comparacao={variacao(d.vendasHoje.faturamento, d.mesmoDiaSemanaPassada.faturamento)} rotuloComparacao="vs. mesmo dia da semana passada" />
        <Indicador rotulo="Vendas hoje" valor={numero(d.vendasHoje.quantidade)}
                   comparacao={variacao(d.vendasHoje.quantidade, d.vendasOntem.quantidade)} rotuloComparacao="vs. ontem" />
        <Indicador rotulo="Ticket médio hoje" valor={moeda(d.vendasHoje.ticketMedio)}
                   comparacao={variacao(d.vendasHoje.ticketMedio, d.vendasOntem.ticketMedio)} rotuloComparacao="vs. ontem" />
        <Indicador rotulo="Faturamento do mês" valor={moeda(d.faturamentoMes)}
                   comparacao={variacao(d.faturamentoMes, d.faturamentoMesAnteriorAteHoje)} rotuloComparacao="vs. mesmo período do mês passado" />
        <Indicador rotulo="Lucro bruto do mês" valor={moeda(d.lucroBrutoMes)} rotuloComparacao={null} />
        <Indicador rotulo="Margem bruta do mês" valor={pct(d.margemBrutaMes)} />
      </div>

      {pendencias.length > 0 && (
        <section className="painel">
          <h3>Pendências</h3>
          <ul className="pendencias">
            {pendencias.map((p, i) => (
              <li key={i} className={p.critico ? 'critico' : ''}><Link to={p.to}>{p.texto}</Link></li>
            ))}
          </ul>
        </section>
      )}

      <div className="grade-paineis">
        <section className="painel largo">
          <h3>Faturamento dos últimos 30 dias</h3>
          <Colunas titulo="Faturamento dos últimos 30 dias" formatar={moeda} marcarCada={Math.ceil(n30 / 10)}
                   dados={d.ultimos30Dias.map((p) => ({
                     rotulo: dataBr(p.periodo), eixo: dataBr(p.periodo).slice(0, 5), valor: p.faturamento,
                     detalhe: [['Vendas', p.quantidade], ['Ticket médio', moeda(p.ticketMedio)]],
                   }))}
                   rotuloEixo={(x) => x.eixo} />
        </section>

        <section className="painel">
          <h3>Vendas por hora hoje</h3>
          <Colunas titulo="Vendas por hora hoje" altura={150} marcarCada={3}
                   formatar={(v) => `${v} ${Number(v) === 1 ? 'venda' : 'vendas'}`}
                   dados={horas.map(({ h, v }) => ({ rotulo: `${h}h às ${h + 1}h`, eixo: `${h}h`, valor: v }))}
                   rotuloEixo={(x) => x.eixo} />
        </section>

        <section className="painel">
          <h3>Mais vendidos do mês</h3>
          <Ranking titulo="Produtos mais vendidos do mês" formatar={moeda}
                   dados={d.topProdutosMes.map((p) => ({ rotulo: p.nome, sub: `${numero(p.quantidade)} ${p.unidade} · margem ${pct(p.margem)}`, valor: p.faturamento }))} />
          <Link to="/relatorios" className="mais">Ver curva ABC completa</Link>
        </section>

        <section className="painel">
          <h3>Formas de pagamento no mês</h3>
          <Ranking titulo="Formas de pagamento no mês" formatar={moeda}
                   dados={d.pagamentosMes.map((p) => ({ rotulo: FORMAS[p.forma], sub: pct(p.participacao), valor: p.valor }))} />
        </section>

        <section className="painel">
          <h3>Financeiro</h3>
          <dl className="ficha">
            <div><dt>A pagar em 7 dias</dt><dd>{moeda(f.pagarProximos7.valor)} <span className="muted">({f.pagarProximos7.quantidade})</span></dd></div>
            <div><dt>A receber em 7 dias</dt><dd>{moeda(f.receberProximos7.valor)} <span className="muted">({f.receberProximos7.quantidade})</span></dd></div>
            <div><dt>Pago no mês</dt><dd>{moeda(f.pagoNoMes)}</dd></div>
            <div><dt>Recebido fora do PDV</dt><dd>{moeda(f.recebidoNoMes)}</dd></div>
          </dl>
          <Link to="/financeiro" className="mais">Abrir financeiro</Link>
        </section>
      </div>
    </>
  )
}
