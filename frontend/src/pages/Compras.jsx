import { useCallback, useEffect, useState } from 'react'
import { comprasApi, fornecedoresApi, mensagemErro, produtosApi } from '../api/recursos'
import Modal from '../components/Modal'
import { useAuth } from '../context/AuthContext'
import { arredonda, dataBr, dataHora, moeda, numero } from '../utils'

const STATUS = { ABERTO: 'Em aberto', RECEBIDO: 'Recebido', CANCELADO: 'Cancelado' }

export default function Compras() {
  const { user } = useAuth()
  const gestor = ['ADMIN', 'GERENTE'].includes(user.perfil)
  const [editando, setEditando] = useState(null) // null = lista; {} = novo; pedido = edição
  const [status, setStatus] = useState('ABERTO')
  const [pagina, setPagina] = useState(0)
  const [dados, setDados] = useState({ itens: [], totalPaginas: 0 })
  const [erro, setErro] = useState('')
  const [detalhe, setDetalhe] = useState(null)
  const [aviso, setAviso] = useState('')

  const carregar = useCallback(() => {
    setErro('')
    comprasApi.listar({ status: status || undefined, pagina, tamanho: 15 }).then(setDados).catch((e) => setErro(mensagemErro(e)))
  }, [status, pagina])
  useEffect(carregar, [carregar])

  const abrir = (id) => comprasApi.buscar(id).then(setDetalhe).catch((e) => setErro(mensagemErro(e)))

  if (editando) {
    return <FormPedido pedido={editando.id ? editando : null}
                       onCancelar={() => setEditando(null)}
                       onSalvo={(p) => { setEditando(null); setAviso(`Pedido nº ${p.id} salvo.`); setStatus('ABERTO'); carregar() }} />
  }

  return (
    <>
      <div className="cabecalho">
        <h2>Compras</h2>
        {gestor && <button onClick={() => { setAviso(''); setEditando({}) }}>Novo pedido</button>}
      </div>
      {aviso && <p className="ok" role="status">{aviso}</p>}
      <div className="filtros">
        <select aria-label="Filtrar por situação" value={status} onChange={(e) => { setStatus(e.target.value); setPagina(0) }}>
          <option value="">Todos</option>
          {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      {erro && <p className="erro" role="alert">{erro}</p>}

      <div className="rolagem">
        <table className="tabela">
          <thead><tr><th>Nº</th><th>Fornecedor</th><th>Criado em</th><th>Previsão</th><th>Itens</th><th>Total</th><th>Situação</th><th></th></tr></thead>
          <tbody>
            {dados.itens.map((p) => (
              <tr key={p.id}>
                <td className="num">{p.id}</td>
                <td>{p.fornecedorNome}</td>
                <td className="num">{dataHora(p.criadoEm)}</td>
                <td className="num">{dataBr(p.previsaoEntrega)}{p.atrasado && <span className="selo critico">atrasado</span>}</td>
                <td className="num">{p.quantidadeItens}</td>
                <td className="num">{moeda(p.totalRecebido ?? p.total)}</td>
                <td><SeloPedido status={p.status} /></td>
                <td className="acoes"><button className="sec" onClick={() => abrir(p.id)}>{p.status === 'ABERTO' ? 'Abrir / receber' : 'Ver'}</button></td>
              </tr>
            ))}
            {dados.itens.length === 0 && <tr><td colSpan="8" className="vazio">Nenhum pedido {status ? STATUS[status].toLowerCase() : ''}.</td></tr>}
          </tbody>
        </table>
      </div>

      {dados.totalPaginas > 1 && (
        <div className="paginacao">
          <button className="sec" disabled={pagina === 0} onClick={() => setPagina(pagina - 1)}>Anterior</button>
          <span>Página {pagina + 1} de {dados.totalPaginas}</span>
          <button className="sec" disabled={pagina + 1 >= dados.totalPaginas} onClick={() => setPagina(pagina + 1)}>Próxima</button>
        </div>
      )}

      {detalhe && (
        <Detalhe pedido={detalhe} gestor={gestor}
                 onFechar={() => setDetalhe(null)}
                 onEditar={() => { setDetalhe(null); setEditando(detalhe) }}
                 onAlterado={(msg) => { setDetalhe(null); setAviso(msg); carregar() }} />
      )}
    </>
  )
}

function SeloPedido({ status }) {
  if (status === 'CANCELADO') return <span className="selo critico">Cancelado</span>
  if (status === 'ABERTO') return <span className="selo alerta">Em aberto</span>
  return <span className="selo ok-selo">Recebido</span>
}

/* ---------------- Formulário de pedido ---------------- */

function FormPedido({ pedido, onCancelar, onSalvo }) {
  const [fornecedores, setFornecedores] = useState([])
  const [fornecedorId, setFornecedorId] = useState(pedido?.fornecedorId ?? '')
  const [itens, setItens] = useState(() => (pedido?.itens ?? []).map((i) => ({
    produtoId: i.produtoId, nome: i.nome, codigoBarras: i.codigoBarras, unidade: i.unidade,
    estoqueAtual: i.estoqueAtual, estoqueMinimo: i.estoqueMinimo, quantidade: String(Number(i.quantidade)), custo: String(Number(i.custoUnitario)),
  })))
  const [cond, setCond] = useState({
    parcelas: pedido?.parcelas ?? 1, primeiroVencimentoDias: pedido?.primeiroVencimentoDias ?? 30,
    intervaloDias: pedido?.intervaloDias ?? 30, previsaoEntrega: pedido?.previsaoEntrega ?? '', observacao: pedido?.observacao ?? '',
  })
  const [busca, setBusca] = useState('')
  const [achados, setAchados] = useState([])
  const [erro, setErro] = useState('')
  const [info, setInfo] = useState('')
  const [salvando, setSalvando] = useState(false)

  useEffect(() => { fornecedoresApi.listar({ busca: '' }).then(setFornecedores).catch(() => {}) }, [])

  useEffect(() => {
    const termo = busca.trim()
    if (termo.length < 2) { setAchados([]); return }
    const t = setTimeout(() => produtosApi.listar({ busca: termo, tamanho: 6 }).then((r) => setAchados(r.itens)).catch(() => {}), 250)
    return () => clearTimeout(t)
  }, [busca])

  function adicionar(p, quantidade = 1, custo = p.precoCusto) {
    setItens((atual) => {
      if (atual.some((i) => i.produtoId === p.id)) return atual
      return [...atual, { produtoId: p.id, nome: p.nome, codigoBarras: p.codigoBarras, unidade: p.unidade,
        estoqueAtual: p.estoqueAtual, estoqueMinimo: p.estoqueMinimo, quantidade: String(Number(quantidade)), custo: String(Number(custo)) }]
    })
    setBusca(''); setAchados([])
  }

  async function sugerir() {
    setErro(''); setInfo('')
    try {
      const lista = await comprasApi.sugestao(fornecedorId || undefined)
      const novos = lista.filter((s) => !itens.some((i) => i.produtoId === s.produtoId))
      novos.forEach((s) => adicionar({ id: s.produtoId, nome: s.nome, codigoBarras: s.codigoBarras, unidade: s.unidade,
        estoqueAtual: s.estoqueAtual, estoqueMinimo: s.estoqueMinimo, precoCusto: s.custoUnitario }, s.quantidadeSugerida, s.custoUnitario))
      setInfo(novos.length ? `${novos.length} ${novos.length === 1 ? 'produto adicionado' : 'produtos adicionados'} com quantidade para chegar ao dobro do estoque mínimo.`
        : fornecedorId ? 'Nenhum produto deste fornecedor está abaixo do estoque mínimo.' : 'Nenhum produto abaixo do estoque mínimo.')
    } catch (e) { setErro(mensagemErro(e)) }
  }

  const alterar = (idx, campo, valor) => setItens(itens.map((i, k) => (k === idx ? { ...i, [campo]: valor } : i)))
  const total = itens.reduce((s, i) => s + arredonda(Number(i.quantidade || 0) * Number(i.custo || 0)), 0)

  async function salvar(e) {
    e.preventDefault()
    setErro('')
    if (!itens.length) { setErro('Adicione pelo menos um produto.'); return }
    setSalvando(true)
    const dados = {
      fornecedorId: Number(fornecedorId),
      previsaoEntrega: cond.previsaoEntrega || null,
      observacao: cond.observacao || null,
      parcelas: Number(cond.parcelas), primeiroVencimentoDias: Number(cond.primeiroVencimentoDias), intervaloDias: Number(cond.intervaloDias),
      itens: itens.map((i) => ({ produtoId: i.produtoId, quantidade: Number(i.quantidade), custoUnitario: Number(i.custo) })),
    }
    try {
      const p = pedido ? await comprasApi.atualizar(pedido.id, dados) : await comprasApi.criar(dados)
      onSalvo(p)
    } catch (err) { setErro(mensagemErro(err)) } finally { setSalvando(false) }
  }

  return (
    <form className="pedido" onSubmit={salvar}>
      <div className="cabecalho">
        <h2>{pedido ? `Editar pedido nº ${pedido.id}` : 'Novo pedido de compra'}</h2>
      </div>

      <div className="linha-campos">
        <div>
          <label htmlFor="forn">Fornecedor</label>
          <select id="forn" required value={fornecedorId} onChange={(e) => setFornecedorId(e.target.value)}>
            <option value="">Selecione…</option>
            {fornecedores.map((f) => <option key={f.id} value={f.id}>{f.razaoSocial}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="prev">Previsão de entrega</label>
          <input id="prev" type="date" value={cond.previsaoEntrega} onChange={(e) => setCond({ ...cond, previsaoEntrega: e.target.value })} />
        </div>
      </div>

      <h3 className="titulo-secao">Itens</h3>
      <div className="linha-campos">
        <div className="cresce">
          <label htmlFor="busca-prod">Adicionar produto</label>
          <input id="busca-prod" type="search" autoComplete="off" placeholder="Nome ou código de barras"
                 value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <button type="button" className="sec alinhado" onClick={sugerir}>Sugerir itens com estoque baixo</button>
      </div>
      {achados.length > 0 && (
        <ul className="achados">
          {achados.map((p) => (
            <li key={p.id}>
              <button type="button" className="sec" onClick={() => adicionar(p)}>
                {p.nome}<small className="sub">{p.codigoBarras} · estoque {numero(p.estoqueAtual)} {p.unidade} · custo {moeda(p.precoCusto)}</small>
              </button>
            </li>
          ))}
        </ul>
      )}
      {info && <p className="muted" role="status">{info}</p>}

      <div className="rolagem">
        <table className="tabela">
          <thead><tr><th>Produto</th><th>Estoque / mín.</th><th>Quantidade</th><th>Custo unit.</th><th>Subtotal</th><th></th></tr></thead>
          <tbody>
            {itens.map((i, k) => {
              const frac = ['KG', 'L'].includes(i.unidade)
              return (
                <tr key={i.produtoId}>
                  <td>{i.nome}<small className="sub">{i.codigoBarras}</small></td>
                  <td className="num">{numero(i.estoqueAtual)} / {numero(i.estoqueMinimo)} {i.unidade}</td>
                  <td><input className="qtd" type="number" required min={frac ? 0.001 : 1} step={frac ? 0.001 : 1}
                             aria-label={`Quantidade de ${i.nome}`} value={i.quantidade} onChange={(e) => alterar(k, 'quantidade', e.target.value)} /></td>
                  <td><input className="qtd" type="number" required min="0" step="0.01"
                             aria-label={`Custo unitário de ${i.nome}`} value={i.custo} onChange={(e) => alterar(k, 'custo', e.target.value)} /></td>
                  <td className="num">{moeda(arredonda(Number(i.quantidade || 0) * Number(i.custo || 0)))}</td>
                  <td className="acoes"><button type="button" className="sec perigo" onClick={() => setItens(itens.filter((_, x) => x !== k))}>Remover</button></td>
                </tr>
              )
            })}
            {itens.length === 0 && <tr><td colSpan="6" className="vazio">Busque um produto ou use a sugestão pelo estoque baixo.</td></tr>}
          </tbody>
          {itens.length > 0 && <tfoot><tr><th colSpan="4">Total do pedido</th><th className="num">{moeda(total)}</th><th></th></tr></tfoot>}
        </table>
      </div>

      <h3 className="titulo-secao">Condição de pagamento</h3>
      <div className="linha-campos">
        <div>
          <label htmlFor="parc">Parcelas</label>
          <input id="parc" type="number" min="1" max="24" required value={cond.parcelas} onChange={(e) => setCond({ ...cond, parcelas: e.target.value })} />
        </div>
        <div>
          <label htmlFor="pv">1º vencimento (dias após receber)</label>
          <input id="pv" type="number" min="0" max="365" required value={cond.primeiroVencimentoDias} onChange={(e) => setCond({ ...cond, primeiroVencimentoDias: e.target.value })} />
        </div>
        <div>
          <label htmlFor="int">Intervalo entre parcelas (dias)</label>
          <input id="int" type="number" min="1" max="180" required disabled={Number(cond.parcelas) <= 1}
                 value={cond.intervaloDias} onChange={(e) => setCond({ ...cond, intervaloDias: e.target.value })} />
        </div>
      </div>
      <p className="muted">
        {Number(cond.parcelas) > 1
          ? `${cond.parcelas}x de aprox. ${moeda(total / Number(cond.parcelas || 1))}: a primeira ${cond.primeiroVencimentoDias} dias após o recebimento e as demais a cada ${cond.intervaloDias} dias.`
          : `Pagamento único ${Number(cond.primeiroVencimentoDias) === 0 ? 'no dia do recebimento' : `${cond.primeiroVencimentoDias} dias após o recebimento`}.`}
        {' '}As contas a pagar são geradas no recebimento, pelo valor efetivamente recebido.
      </p>

      <label htmlFor="obs">Observação</label>
      <input id="obs" maxLength={300} value={cond.observacao} onChange={(e) => setCond({ ...cond, observacao: e.target.value })} />

      {erro && <p className="erro" role="alert">{erro}</p>}
      <div className="botoes">
        <button type="button" className="sec" onClick={onCancelar}>Voltar</button>
        <button type="submit" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar pedido'}</button>
      </div>
    </form>
  )
}

/* ---------------- Detalhe, recebimento e cancelamento ---------------- */

function Detalhe({ pedido, gestor, onFechar, onEditar, onAlterado }) {
  const [modo, setModo] = useState('ver')
  const [erro, setErro] = useState('')
  const [motivo, setMotivo] = useState('')
  const [nota, setNota] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [receb, setReceb] = useState(() => Object.fromEntries(pedido.itens.map((i) => [i.id, {
    quantidade: String(Number(i.quantidade)), custo: String(Number(i.custoUnitario)),
  }])))

  const totalReceb = pedido.itens.reduce((s, i) => s + arredonda(Number(receb[i.id].quantidade || 0) * Number(receb[i.id].custo || 0)), 0)

  async function receber(e) {
    e.preventDefault()
    setErro(''); setEnviando(true)
    try {
      const p = await comprasApi.receber(pedido.id, {
        numeroNota: nota || null,
        itens: pedido.itens.map((i) => ({ itemId: i.id, quantidade: Number(receb[i.id].quantidade), custoUnitario: Number(receb[i.id].custo) })),
      })
      const parc = p.contas.length
      onAlterado(`Pedido nº ${p.id} recebido: estoque atualizado${parc ? ` e ${parc} ${parc === 1 ? 'conta a pagar gerada' : 'parcelas geradas no contas a pagar'}` : ''}.`)
    } catch (err) { setErro(mensagemErro(err)) } finally { setEnviando(false) }
  }

  async function cancelar(e) {
    e.preventDefault()
    setErro('')
    try { await comprasApi.cancelar(pedido.id, motivo); onAlterado(`Pedido nº ${pedido.id} cancelado.`) } catch (err) { setErro(mensagemErro(err)) }
  }

  return (
    <Modal titulo={`Pedido de compra nº ${pedido.id}`} onFechar={onFechar}>
      <dl className="ficha">
        <div><dt>Fornecedor</dt><dd>{pedido.fornecedorNome}</dd></div>
        <div><dt>Situação</dt><dd><SeloPedido status={pedido.status} /></dd></div>
        <div><dt>Criado</dt><dd>{dataHora(pedido.criadoEm)} por {pedido.criadoPor}</dd></div>
        <div><dt>Previsão</dt><dd>{dataBr(pedido.previsaoEntrega)}</dd></div>
        <div><dt>Pagamento</dt><dd>{pedido.parcelas}x · 1º venc. {pedido.primeiroVencimentoDias} dias{pedido.parcelas > 1 ? ` · a cada ${pedido.intervaloDias} dias` : ''}</dd></div>
        {pedido.recebidoEm && <div><dt>Recebido</dt><dd>{dataHora(pedido.recebidoEm)} por {pedido.recebidoPor}{pedido.numeroNota ? ` · NF ${pedido.numeroNota}` : ''}</dd></div>}
        {pedido.canceladoEm && <div><dt>Cancelado</dt><dd>{dataHora(pedido.canceladoEm)} por {pedido.canceladoPor}: {pedido.motivoCancelamento}</dd></div>}
        {pedido.observacao && <div><dt>Observação</dt><dd>{pedido.observacao}</dd></div>}
      </dl>

      {modo === 'receber' ? (
        <form onSubmit={receber}>
          <p className="muted">Confira a mercadoria. Ajuste a quantidade que chegou (0 se não veio) e o custo da nota, se mudou.</p>
          <div className="rolagem">
            <table className="tabela compacta">
              <thead><tr><th>Produto</th><th>Pedido</th><th>Recebido</th><th>Custo</th></tr></thead>
              <tbody>
                {pedido.itens.map((i) => {
                  const frac = ['KG', 'L'].includes(i.unidade)
                  return (
                    <tr key={i.id}>
                      <td>{i.nome}</td>
                      <td className="num">{numero(i.quantidade)} {i.unidade}</td>
                      <td><input className="qtd" type="number" min="0" step={frac ? 0.001 : 1} required aria-label={`Quantidade recebida de ${i.nome}`}
                                 value={receb[i.id].quantidade} onChange={(e) => setReceb({ ...receb, [i.id]: { ...receb[i.id], quantidade: e.target.value } })} /></td>
                      <td><input className="qtd" type="number" min="0" step="0.01" required aria-label={`Custo de ${i.nome}`}
                                 value={receb[i.id].custo} onChange={(e) => setReceb({ ...receb, [i.id]: { ...receb[i.id], custo: e.target.value } })} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <label htmlFor="nota">Número da nota fiscal</label>
          <input id="nota" maxLength={60} value={nota} onChange={(e) => setNota(e.target.value)} />
          <p><strong>Total recebido: {moeda(totalReceb)}</strong></p>
          <p className="muted">O custo dos produtos passa a ser o custo médio entre o saldo atual e esta compra.</p>
          {erro && <p className="erro" role="alert">{erro}</p>}
          <div className="botoes">
            <button type="button" className="sec" onClick={() => setModo('ver')}>Voltar</button>
            <button type="submit" disabled={enviando}>{enviando ? 'Recebendo…' : 'Confirmar recebimento'}</button>
          </div>
        </form>
      ) : modo === 'cancelar' ? (
        <form onSubmit={cancelar}>
          <label htmlFor="motivo">Motivo do cancelamento</label>
          <input id="motivo" required maxLength={200} autoFocus value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          {erro && <p className="erro" role="alert">{erro}</p>}
          <div className="botoes">
            <button type="button" className="sec" onClick={() => setModo('ver')}>Voltar</button>
            <button type="submit" className="perigo-cheio">Cancelar pedido</button>
          </div>
        </form>
      ) : (
        <>
          <div className="rolagem">
            <table className="tabela compacta">
              <thead><tr><th>Produto</th><th>Qtd.</th><th>Custo</th><th>Total</th></tr></thead>
              <tbody>
                {pedido.itens.map((i) => (
                  <tr key={i.id}>
                    <td>{i.nome}<small className="sub">{i.codigoBarras}</small></td>
                    <td className="num">
                      {numero(i.quantidade)} {i.unidade}
                      {i.quantidadeRecebida != null && Number(i.quantidadeRecebida) !== Number(i.quantidade) &&
                        <small className="sub">recebido {numero(i.quantidadeRecebida)}</small>}
                    </td>
                    <td className="num">{moeda(i.custoRecebido ?? i.custoUnitario)}</td>
                    <td className="num">{moeda(i.quantidadeRecebida != null ? arredonda(i.quantidadeRecebida * (i.custoRecebido ?? i.custoUnitario)) : i.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr><th colSpan="3">Total</th><th className="num">{moeda(pedido.totalRecebido ?? pedido.total)}</th></tr></tfoot>
            </table>
          </div>

          {pedido.contas.length > 0 && (
            <>
              <h3 className="titulo-secao">Contas a pagar geradas</h3>
              <ul className="parcelas">
                {pedido.contas.map((c) => (
                  <li key={c.id}>
                    <span>{c.parcela ?? 'Única'} · vence {dataBr(c.vencimento)}</span>
                    <span>{moeda(c.valor)} <SeloConta status={c.status} /></span>
                  </li>
                ))}
              </ul>
            </>
          )}

          <div className="botoes">
            {pedido.status === 'ABERTO' && gestor && <button className="sec perigo" onClick={() => setModo('cancelar')}>Cancelar pedido…</button>}
            {pedido.status === 'ABERTO' && gestor && <button className="sec" onClick={onEditar}>Editar</button>}
            {pedido.status === 'ABERTO' && <button onClick={() => setModo('receber')}>Receber mercadoria</button>}
            {pedido.status !== 'ABERTO' && <button onClick={onFechar}>Fechar</button>}
          </div>
        </>
      )}
    </Modal>
  )
}

export function SeloConta({ status }) {
  const mapa = { ABERTA: ['Em aberto', 'aberta'],VENCIDA: ['Vencida', 'critico'], PAGA: ['Paga', 'ok-selo'], CANCELADA: ['Cancelada', 'neutro'] }
  const [t, c] = mapa[status] ?? [status, '']
  return <span className={`selo ${c}`}>{t}</span>
}
