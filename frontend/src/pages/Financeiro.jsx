import { useCallback, useEffect, useState } from 'react'
import { financeiroApi, fornecedoresApi, mensagemErro } from '../api/recursos'
import { Divergente } from '../components/Graficos'
import Modal from '../components/Modal'
import { SeloConta } from './Compras'
import { CATEGORIAS_CONTA, FORMAS, PRESETS, baixarCsv, dataBr, hojeIso, moeda, periodoPreset } from '../utils'

const ABAS = [['pagar', 'Contas a pagar'], ['receber', 'Contas a receber'], ['fluxo', 'Fluxo de caixa']]
const STATUS = { ABERTA: 'Em aberto', VENCIDA: 'Vencidas', PAGA: 'Pagas', CANCELADA: 'Canceladas' }

export default function Financeiro() {
  // A aba pode vir no endereço (ex.: /financeiro#fluxo), usado pelos atalhos do painel.
  const [aba, setAbaEstado] = useState(() => {
    const h = window.location.hash.slice(1)
    return ABAS.some(([id]) => id === h) ? h : 'pagar'
  })
  const setAba = (id) => { setAbaEstado(id); window.history.replaceState(null, '', `#${id}`) }
  const [resumo, setResumo] = useState(null)
  const atualizarResumo = useCallback(() => { financeiroApi.resumo().then(setResumo).catch(() => {}) }, [])
  useEffect(atualizarResumo, [atualizarResumo])

  return (
    <>
      <h2>Financeiro</h2>
      {resumo && (
        <div className="indicadores">
          <Cartao rotulo="A pagar vencido" t={resumo.pagarVencidas} critico />
          <Cartao rotulo="A pagar hoje" t={resumo.pagarHoje} />
          <Cartao rotulo="A pagar em 7 dias" t={resumo.pagarProximos7} />
          <Cartao rotulo="A receber em 7 dias" t={resumo.receberProximos7} />
          <div className="indicador"><span className="i-rotulo">Pago no mês</span><strong className="i-valor">{moeda(resumo.pagoNoMes)}</strong></div>
          <div className="indicador"><span className="i-rotulo">Recebido no mês (fora do PDV)</span><strong className="i-valor">{moeda(resumo.recebidoNoMes)}</strong></div>
        </div>
      )}
      <div className="abas" role="tablist">
        {ABAS.map(([id, nome]) => (
          <button key={id} role="tab" aria-selected={aba === id} className={aba === id ? 'ativa' : ''} onClick={() => setAba(id)}>{nome}</button>
        ))}
      </div>
      {aba === 'pagar' && <Contas key="p" tipo="PAGAR" onMudou={atualizarResumo} />}
      {aba === 'receber' && <Contas key="r" tipo="RECEBER" onMudou={atualizarResumo} />}
      {aba === 'fluxo' && <Fluxo />}
    </>
  )
}

function Cartao({ rotulo, t, critico }) {
  return (
    <div className={`indicador${critico && t.quantidade > 0 ? ' alerta-critico' : ''}`}>
      <span className="i-rotulo">{rotulo}</span>
      <strong className="i-valor">{moeda(t.valor)}</strong>
      <span className="i-var">{t.quantidade} {t.quantidade === 1 ? 'conta' : 'contas'}</span>
    </div>
  )
}

/* ---------------- Contas ---------------- */

function Contas({ tipo, onMudou }) {
  const pagar = tipo === 'PAGAR'
  const [status, setStatus] = useState('ABERTA')
  const [de, setDe] = useState('')
  const [ate, setAte] = useState('')
  const [busca, setBusca] = useState('')
  const [termo, setTermo] = useState('')
  const [pagina, setPagina] = useState(0)
  const [dados, setDados] = useState({ itens: [], totalPaginas: 0, total: 0 })
  const [erro, setErro] = useState('')
  const [ok, setOk] = useState('')
  const [form, setForm] = useState(null)
  const [baixa, setBaixa] = useState(null)
  const [cancelar, setCancelar] = useState(null)

  useEffect(() => { const t = setTimeout(() => setTermo(busca), 300); return () => clearTimeout(t) }, [busca])

  const carregar = useCallback(() => {
    setErro('')
    financeiroApi.listar({ tipo, status: status || undefined, de: de || undefined, ate: ate || undefined, busca: termo || undefined, pagina, tamanho: 20 })
      .then(setDados).catch((e) => setErro(mensagemErro(e)))
  }, [tipo, status, de, ate, termo, pagina])
  useEffect(carregar, [carregar])

  const depois = (msg) => { setOk(msg); setForm(null); setBaixa(null); setCancelar(null); carregar(); onMudou() }

  async function estornar(c) {
    if (!window.confirm(`Desfazer a baixa de “${c.descricao}”? A conta volta para em aberto.`)) return
    try { await financeiroApi.estornar(c.id); depois('Baixa desfeita.') } catch (e) { setErro(mensagemErro(e)) }
  }

  const somaPagina = dados.itens.reduce((s, c) => s + Number(status === 'PAGA' ? c.valorPago : c.valor), 0)

  function exportar() {
    baixarCsv(`contas-a-${pagar ? 'pagar' : 'receber'}-${hojeIso()}`, [
      ['Descrição', (c) => c.descricao], ['Categoria', (c) => CATEGORIAS_CONTA[c.categoria]], ['Fornecedor', (c) => c.fornecedorNome],
      ['Parcela', (c) => c.parcela], ['Vencimento', (c) => dataBr(c.vencimento)], ['Valor', (c) => Number(c.valor)],
      ['Situação', (c) => c.status], ['Pago em', (c) => dataBr(c.pagoEm)], ['Valor pago', (c) => (c.valorPago == null ? null : Number(c.valorPago))],
      ['Forma', (c) => FORMAS[c.formaPagamento]],
    ], dados.itens)
  }

  return (
    <>
      {ok && <p className="ok" role="status">{ok}</p>}
      <div className="filtros quebra">
        <select aria-label="Situação" value={status} onChange={(e) => { setStatus(e.target.value); setPagina(0) }}>
          <option value="">Todas</option>
          {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <label className="inline">{status === 'PAGA' ? 'Pagas de' : 'Vencimento de'} <input type="date" value={de} onChange={(e) => { setDe(e.target.value); setPagina(0) }} /></label>
        <label className="inline">até <input type="date" value={ate} min={de || undefined} onChange={(e) => { setAte(e.target.value); setPagina(0) }} /></label>
        <input type="search" placeholder="Buscar descrição ou fornecedor" aria-label="Buscar conta" value={busca} onChange={(e) => { setBusca(e.target.value); setPagina(0) }} />
        <span className="espaco" />
        <button className="sec" onClick={exportar} disabled={!dados.itens.length}>Exportar CSV</button>
        <button onClick={() => { setOk(''); setForm({ tipo }) }}>{pagar ? 'Nova despesa' : 'Nova receita'}</button>
      </div>
      {erro && <p className="erro" role="alert">{erro}</p>}

      <div className="rolagem">
        <table className="tabela">
          <thead><tr><th>Vencimento</th><th>Descrição</th><th>Categoria</th><th>Valor</th><th>Situação</th><th></th></tr></thead>
          <tbody>
            {dados.itens.map((c) => (
              <tr key={c.id}>
                <td className="num">{dataBr(c.vencimento)}{c.diasAtraso && <small className="sub neg">{c.diasAtraso} {c.diasAtraso === 1 ? 'dia' : 'dias'} de atraso</small>}</td>
                <td>{c.descricao}{c.parcela && <span className="muted"> ({c.parcela})</span>}
                  <small className="sub">{[c.fornecedorNome, c.observacao].filter(Boolean).join(' · ')}</small></td>
                <td>{CATEGORIAS_CONTA[c.categoria]}</td>
                <td className="num">{moeda(c.valor)}
                  {c.status === 'PAGA' && <small className="sub">pago {moeda(c.valorPago)} em {dataBr(c.pagoEm)} · {FORMAS[c.formaPagamento]}</small>}</td>
                <td><SeloConta status={c.status} /></td>
                <td className="acoes">
                  {['ABERTA', 'VENCIDA'].includes(c.status) && <>
                    <button className="sec" onClick={() => { setOk(''); setBaixa(c) }}>{pagar ? 'Pagar' : 'Receber'}</button>
                    <button className="sec" onClick={() => { setOk(''); setForm(c) }}>Editar</button>
                    <button className="sec perigo" onClick={() => { setOk(''); setCancelar(c) }}>Cancelar</button>
                  </>}
                  {c.status === 'PAGA' && <button className="sec" onClick={() => estornar(c)}>Desfazer baixa</button>}
                </td>
              </tr>
            ))}
            {dados.itens.length === 0 && <tr><td colSpan="6" className="vazio">Nenhuma conta encontrada.</td></tr>}
          </tbody>
          {dados.itens.length > 0 && (
            <tfoot><tr><th colSpan="3">{dados.total} {dados.total === 1 ? 'conta' : 'contas'}{dados.totalPaginas > 1 ? ' · soma desta página' : ' · total'}</th>
              <th className="num">{moeda(somaPagina)}</th><th colSpan="2"></th></tr></tfoot>
          )}
        </table>
      </div>

      {dados.totalPaginas > 1 && (
        <div className="paginacao">
          <button className="sec" disabled={pagina === 0} onClick={() => setPagina(pagina - 1)}>Anterior</button>
          <span>Página {pagina + 1} de {dados.totalPaginas}</span>
          <button className="sec" disabled={pagina + 1 >= dados.totalPaginas} onClick={() => setPagina(pagina + 1)}>Próxima</button>
        </div>
      )}

      {form && <FormConta conta={form} onFechar={() => setForm(null)} onSalvo={depois} />}
      {baixa && <FormBaixa conta={baixa} onFechar={() => setBaixa(null)} onSalvo={depois} />}
      {cancelar && <FormCancelar conta={cancelar} onFechar={() => setCancelar(null)} onSalvo={depois} />}
    </>
  )
}

function FormConta({ conta, onFechar, onSalvo }) {
  const editando = Boolean(conta.id)
  const pagar = conta.tipo === 'PAGAR'
  const doPedido = Boolean(conta.pedidoCompraId)
  const [f, setF] = useState({
    descricao: conta.descricao ?? '', categoria: conta.categoria ?? (pagar ? 'OUTROS' : 'RECEITA_DIVERSA'),
    fornecedorId: conta.fornecedorId ?? '', valor: conta.valor ?? '', vencimento: conta.vencimento ?? hojeIso(),
    repeticoes: 1, observacao: conta.observacao ?? '',
  })
  const [fornecedores, setFornecedores] = useState([])
  const [erro, setErro] = useState('')
  useEffect(() => { if (pagar) fornecedoresApi.listar({ busca: '' }).then(setFornecedores).catch(() => {}) }, [pagar])

  const campo = (k) => ({ value: f[k], onChange: (e) => setF({ ...f, [k]: e.target.value }) })
  const categorias = Object.entries(CATEGORIAS_CONTA).filter(([k]) =>
    pagar ? k !== 'RECEITA_DIVERSA' : ['RECEITA_DIVERSA', 'OUTROS'].includes(k))

  async function salvar(e) {
    e.preventDefault()
    setErro('')
    const dados = { ...f, valor: Number(f.valor), fornecedorId: f.fornecedorId ? Number(f.fornecedorId) : null,
      repeticoes: Number(f.repeticoes), observacao: f.observacao || null }
    try {
      if (editando) { await financeiroApi.atualizar(conta.id, dados); onSalvo('Conta atualizada.') }
      else {
        const criadas = await financeiroApi.criar({ ...dados, tipo: conta.tipo })
        onSalvo(criadas.length > 1 ? `${criadas.length} contas lançadas (uma por mês).` : 'Conta lançada.')
      }
    } catch (err) { setErro(mensagemErro(err)) }
  }

  return (
    <Modal titulo={editando ? 'Editar conta' : pagar ? 'Nova despesa' : 'Nova receita'} onFechar={onFechar}>
      <form className="grade" onSubmit={salvar}>
        <div className="col4"><label htmlFor="desc">Descrição</label><input id="desc" required maxLength={160} autoFocus {...campo('descricao')} /></div>
        <div className="col2"><label htmlFor="cat">Categoria</label>
          <select id="cat" disabled={doPedido} {...campo('categoria')}>
            {categorias.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select></div>
        {pagar && <div className="col2"><label htmlFor="fornc">Fornecedor (opcional)</label>
          <select id="fornc" disabled={doPedido} {...campo('fornecedorId')}>
            <option value="">—</option>
            {fornecedores.map((x) => <option key={x.id} value={x.id}>{x.razaoSocial}</option>)}
          </select></div>}
        <div className="col2"><label htmlFor="val">Valor (R$)</label><input id="val" type="number" min="0.01" step="0.01" required disabled={doPedido} {...campo('valor')} /></div>
        <div className="col2"><label htmlFor="venc">Vencimento</label><input id="venc" type="date" required {...campo('vencimento')} /></div>
        {!editando && <div className="col2"><label htmlFor="rep">Repetir por (meses)</label><input id="rep" type="number" min="1" max="24" {...campo('repeticoes')} /></div>}
        <div className="col4"><label htmlFor="obsc">Observação</label><input id="obsc" maxLength={300} {...campo('observacao')} /></div>
        {doPedido && <p className="muted col4">Parcela gerada pelo pedido de compra nº {conta.pedidoCompraId}: só a descrição, o vencimento e a observação podem mudar.</p>}
        {erro && <p className="erro col4" role="alert">{erro}</p>}
        <div className="botoes col4">
          <button type="button" className="sec" onClick={onFechar}>Cancelar</button>
          <button type="submit">Salvar</button>
        </div>
      </form>
    </Modal>
  )
}

function FormBaixa({ conta, onFechar, onSalvo }) {
  const pagar = conta.tipo === 'PAGAR'
  const [pagoEm, setPagoEm] = useState(hojeIso())
  const [valor, setValor] = useState(String(Number(conta.valor)))
  const [forma, setForma] = useState('PIX')
  const [erro, setErro] = useState('')

  async function salvar(e) {
    e.preventDefault()
    setErro('')
    try {
      await financeiroApi.baixar(conta.id, { pagoEm, valorPago: Number(valor), forma })
      onSalvo(`${pagar ? 'Pagamento' : 'Recebimento'} de ${moeda(valor)} registrado.`)
    } catch (err) { setErro(mensagemErro(err)) }
  }

  const dif = Number(valor) - Number(conta.valor)
  return (
    <Modal titulo={pagar ? 'Registrar pagamento' : 'Registrar recebimento'} onFechar={onFechar}>
      <p><strong>{conta.descricao}</strong>{conta.parcela && ` (${conta.parcela})`}<br />
        <span className="muted">Vencimento {dataBr(conta.vencimento)} · valor {moeda(conta.valor)}</span></p>
      <form onSubmit={salvar}>
        <label htmlFor="data">Data do {pagar ? 'pagamento' : 'recebimento'}</label>
        <input id="data" type="date" required max={hojeIso()} value={pagoEm} onChange={(e) => setPagoEm(e.target.value)} />
        <label htmlFor="vp">Valor {pagar ? 'pago' : 'recebido'} (R$)</label>
        <input id="vp" type="number" min="0.01" step="0.01" required value={valor} onChange={(e) => setValor(e.target.value)} />
        {Math.abs(dif) >= 0.005 && <p className="muted">{dif > 0 ? `Juros/multa de ${moeda(dif)}` : `Desconto de ${moeda(-dif)}`} em relação ao valor original.</p>}
        <label htmlFor="forma">Forma</label>
        <select id="forma" value={forma} onChange={(e) => setForma(e.target.value)}>
          {Object.entries(FORMAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        {erro && <p className="erro" role="alert">{erro}</p>}
        <div className="botoes">
          <button type="button" className="sec" onClick={onFechar}>Cancelar</button>
          <button type="submit">Confirmar</button>
        </div>
      </form>
    </Modal>
  )
}

function FormCancelar({ conta, onFechar, onSalvo }) {
  const [motivo, setMotivo] = useState('')
  const [erro, setErro] = useState('')
  async function salvar(e) {
    e.preventDefault()
    try { await financeiroApi.cancelar(conta.id, motivo); onSalvo('Conta cancelada.') } catch (err) { setErro(mensagemErro(err)) }
  }
  return (
    <Modal titulo="Cancelar conta" onFechar={onFechar}>
      <p><strong>{conta.descricao}</strong> · {moeda(conta.valor)} · vence {dataBr(conta.vencimento)}</p>
      <form onSubmit={salvar}>
        <label htmlFor="mot">Motivo</label>
        <input id="mot" required maxLength={200} autoFocus value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        {erro && <p className="erro" role="alert">{erro}</p>}
        <div className="botoes">
          <button type="button" className="sec" onClick={onFechar}>Voltar</button>
          <button type="submit" className="perigo-cheio">Cancelar conta</button>
        </div>
      </form>
    </Modal>
  )
}

/* ---------------- Fluxo de caixa ---------------- */

function Fluxo() {
  const [[de, ate], setPeriodo] = useState(() => periodoPreset('mes'))
  const [fluxo, setFluxo] = useState(null)
  const [erro, setErro] = useState('')

  useEffect(() => {
    if (!de || !ate) return
    setErro('')
    financeiroApi.fluxo({ de, ate }).then(setFluxo).catch((e) => { setFluxo(null); setErro(mensagemErro(e)) })
  }, [de, ate])

  function exportar() {
    baixarCsv(`fluxo-de-caixa-${de}-a-${ate}`, [
      ['Data', (d) => dataBr(d.data)], ['Vendas', (d) => Number(d.vendas)], ['Outras entradas', (d) => Number(d.outrasEntradas)],
      ['Saídas', (d) => Number(d.saidas)], ['Saldo do dia', (d) => Number(d.saldoDia)], ['Saldo acumulado', (d) => Number(d.saldoAcumulado)],
    ], fluxo.dias)
  }

  const n = fluxo?.dias.length ?? 0
  return (
    <>
      <SeletorPeriodo de={de} ate={ate} onMudar={setPeriodo}>
        <button className="sec" onClick={exportar} disabled={!fluxo}>Exportar CSV</button>
      </SeletorPeriodo>
      {erro && <p className="erro" role="alert">{erro}</p>}
      {fluxo && (
        <>
          <div className="indicadores">
            <div className="indicador"><span className="i-rotulo">Vendas (PDV)</span><strong className="i-valor">{moeda(fluxo.totalVendas)}</strong></div>
            <div className="indicador"><span className="i-rotulo">Outras entradas</span><strong className="i-valor">{moeda(fluxo.totalOutrasEntradas)}</strong></div>
            <div className="indicador"><span className="i-rotulo">Saídas (contas pagas)</span><strong className="i-valor">{moeda(fluxo.totalSaidas)}</strong></div>
            <div className={`indicador destaque${Number(fluxo.resultado) < 0 ? ' negativo' : ''}`}><span className="i-rotulo">Resultado do período</span><strong className="i-valor">{moeda(fluxo.resultado)}</strong></div>
          </div>
          <p className="muted">Ainda em aberto com vencimento no período: {moeda(fluxo.aPagarNoPeriodo.valor)} a pagar ({fluxo.aPagarNoPeriodo.quantidade}) e {moeda(fluxo.aReceberNoPeriodo.valor)} a receber ({fluxo.aReceberNoPeriodo.quantidade}).</p>

          <section className="painel">
            <h3>Entradas e saídas por dia</h3>
            <Divergente titulo="Entradas e saídas por dia" formatar={moeda} marcarCada={Math.ceil(n / 12)}
                        dados={fluxo.dias.map((d) => ({
                          rotulo: dataBr(d.data), eixo: d.data.slice(8, 10) + '/' + d.data.slice(5, 7),
                          positivo: Number(d.vendas) + Number(d.outrasEntradas), negativo: d.saidas,
                          detalhe: [['Saldo do dia', moeda(d.saldoDia)], ['Acumulado', moeda(d.saldoAcumulado)]],
                        }))} />
          </section>

          <div className="rolagem">
            <table className="tabela">
              <thead><tr><th>Data</th><th>Vendas</th><th>Outras entradas</th><th>Saídas</th><th>Saldo do dia</th><th>Acumulado</th></tr></thead>
              <tbody>
                {fluxo.dias.filter((d) => Number(d.vendas) || Number(d.outrasEntradas) || Number(d.saidas)).map((d) => (
                  <tr key={d.data}>
                    <td className="num">{dataBr(d.data)}</td>
                    <td className="num">{moeda(d.vendas)}</td>
                    <td className="num">{moeda(d.outrasEntradas)}</td>
                    <td className="num">{moeda(d.saidas)}</td>
                    <td className={`num ${Number(d.saldoDia) < 0 ? 'neg' : ''}`}>{moeda(d.saldoDia)}</td>
                    <td className={`num ${Number(d.saldoAcumulado) < 0 ? 'neg' : ''}`}>{moeda(d.saldoAcumulado)}</td>
                  </tr>
                ))}
                {!fluxo.dias.some((d) => Number(d.vendas) || Number(d.outrasEntradas) || Number(d.saidas)) &&
                  <tr><td colSpan="6" className="vazio">Nenhuma movimentação no período.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  )
}

/** Período com atalhos (hoje, 7 dias, mês…) e datas livres. Reutilizado nos relatórios. */
export function SeletorPeriodo({ de, ate, onMudar, children }) {
  const [preset, setPreset] = useState('mes')
  return (
    <div className="filtros quebra">
      <select aria-label="Período" value={preset} onChange={(e) => {
        setPreset(e.target.value)
        if (e.target.value !== 'livre') onMudar(periodoPreset(e.target.value))
      }}>
        {PRESETS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        <option value="livre">Personalizado</option>
      </select>
      <label className="inline">De <input type="date" value={de} max={ate} onChange={(e) => { setPreset('livre'); onMudar([e.target.value, ate]) }} /></label>
      <label className="inline">Até <input type="date" value={ate} min={de} onChange={(e) => { setPreset('livre'); onMudar([de, e.target.value]) }} /></label>
      <span className="espaco" />
      {children}
    </div>
  )
}
