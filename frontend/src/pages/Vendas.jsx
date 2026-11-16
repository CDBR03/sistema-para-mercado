import { useCallback, useEffect, useState } from 'react'
import { mensagemErro, vendasApi } from '../api/recursos'
import Cupom from '../components/Cupom'
import Modal from '../components/Modal'
import { FORMAS, dataHora, hojeIso, moeda } from '../utils'

const STATUS = { CONCLUIDA: 'Concluída', CANCELADA: 'Cancelada' }

export default function Vendas() {
  const [de, setDe] = useState(hojeIso())
  const [ate, setAte] = useState(hojeIso())
  const [status, setStatus] = useState('')
  const [pagina, setPagina] = useState(0)
  const [dados, setDados] = useState({ itens: [], totalPaginas: 0, total: 0 })
  const [periodo, setPeriodo] = useState(null)
  const [erro, setErro] = useState('')
  const [detalhe, setDetalhe] = useState(null)

  const carregar = useCallback(() => {
    setErro('')
    const filtro = { de: de || undefined, ate: ate || undefined }
    vendasApi.listar({ ...filtro, status: status || undefined, pagina, tamanho: 15 }).then(setDados).catch((e) => setErro(mensagemErro(e)))
    if (de && ate) vendasApi.periodo({ de, ate }).then(setPeriodo).catch(() => setPeriodo(null))
  }, [de, ate, status, pagina])
  useEffect(carregar, [carregar])

  const abrir = (id) => vendasApi.buscar(id).then(setDetalhe).catch((e) => setErro(mensagemErro(e)))

  return (
    <>
      <h2>Vendas</h2>
      <div className="filtros">
        <label className="inline">De <input type="date" value={de} max={ate || undefined} onChange={(e) => { setDe(e.target.value); setPagina(0) }} /></label>
        <label className="inline">Até <input type="date" value={ate} min={de || undefined} onChange={(e) => { setAte(e.target.value); setPagina(0) }} /></label>
        <select aria-label="Filtrar por situação" value={status} onChange={(e) => { setStatus(e.target.value); setPagina(0) }}>
          <option value="">Todas</option>
          {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {periodo && (
        <dl className="resumo">
          <div><dt>Vendas concluídas</dt><dd>{periodo.quantidade}</dd></div>
          <div><dt>Faturamento</dt><dd>{moeda(periodo.faturamento)}</dd></div>
          <div><dt>Ticket médio</dt><dd>{moeda(periodo.ticketMedio)}</dd></div>
        </dl>
      )}
      {erro && <p className="erro" role="alert">{erro}</p>}

      <div className="rolagem">
        <table className="tabela">
          <thead><tr><th>Nº</th><th>Data</th><th>Operador</th><th>Itens</th><th>Pagamento</th><th>Total</th><th>Situação</th><th></th></tr></thead>
          <tbody>
            {dados.itens.map((v) => (
              <tr key={v.id}>
                <td className="num">{v.id}</td>
                <td className="num">{dataHora(v.criadoEm)}</td>
                <td>{v.operador}</td>
                <td className="num">{v.quantidadeItens}</td>
                <td>{v.formas.map((f) => FORMAS[f]).join(', ')}</td>
                <td className="num">{moeda(v.total)}</td>
                <td>{v.status === 'CANCELADA' ? <span className="selo critico">Cancelada</span> : 'Concluída'}</td>
                <td className="acoes"><button className="sec" onClick={() => abrir(v.id)}>Ver cupom</button></td>
              </tr>
            ))}
            {dados.itens.length === 0 && <tr><td colSpan="8" className="vazio">Nenhuma venda neste período.</td></tr>}
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

      {detalhe && <Detalhe venda={detalhe} onFechar={() => setDetalhe(null)} onCancelada={() => { setDetalhe(null); carregar() }} />}
    </>
  )
}

function Detalhe({ venda, onFechar, onCancelada }) {
  const [cancelando, setCancelando] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [erro, setErro] = useState('')

  async function cancelar(e) {
    e.preventDefault()
    setErro('')
    try { await vendasApi.cancelar(venda.id, motivo); onCancelada() } catch (err) { setErro(mensagemErro(err)) }
  }

  return (
    <Modal titulo={`Venda nº ${venda.id}`} onFechar={onFechar}>
      <Cupom venda={venda} />
      {venda.status === 'CANCELADA' && (
        <p className="muted">Cancelada por {venda.canceladaPor}. Motivo: {venda.motivoCancelamento}</p>
      )}
      {cancelando ? (
        <form onSubmit={cancelar}>
          <label htmlFor="motivo">Motivo do cancelamento</label>
          <input id="motivo" required maxLength={200} autoFocus value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          <p className="muted">Os itens voltam ao estoque automaticamente.</p>
          {erro && <p className="erro" role="alert">{erro}</p>}
          <div className="botoes">
            <button type="button" className="sec" onClick={() => setCancelando(false)}>Voltar</button>
            <button type="submit" className="perigo-cheio">Cancelar venda</button>
          </div>
        </form>
      ) : (
        <div className="botoes">
          {venda.status === 'CONCLUIDA' && <button className="sec perigo" onClick={() => setCancelando(true)}>Cancelar venda…</button>}
          <button className="sec" onClick={() => window.print()}>Imprimir</button>
          <button onClick={onFechar}>Fechar</button>
        </div>
      )}
    </Modal>
  )
}
