import { useCallback, useEffect, useState } from 'react'
import { estoqueApi, mensagemErro, produtosApi } from '../api/recursos'
import { useAuth } from '../context/AuthContext'
import { dataBr, dataHora, diasAte, moeda, numero } from '../utils'

const ABAS = [['alertas', 'Alertas'], ['movimentar', 'Movimentar'], ['historico', 'Histórico']]
const TIPOS = { ENTRADA: 'Entrada', SAIDA: 'Saída', AJUSTE: 'Ajuste', VENDA: 'Venda', COMPRA: 'Compra', ESTORNO: 'Estorno' }

export default function Estoque() {
  const { user } = useAuth()
  const gestor = ['ADMIN', 'GERENTE'].includes(user.perfil)
  const [aba, setAba] = useState('alertas')
  const [selecionado, setSelecionado] = useState(null)

  function repor(item) { setSelecionado(item); setAba('movimentar') }

  return (
    <>
      <h2>Estoque</h2>
      <div className="abas" role="tablist">
        {ABAS.map(([id, nome]) => (
          <button key={id} role="tab" aria-selected={aba === id} className={aba === id ? 'ativa' : ''}
                  onClick={() => setAba(id)}>{nome}</button>
        ))}
      </div>
      {aba === 'alertas' && <Alertas gestor={gestor} onRepor={repor} />}
      {aba === 'movimentar' && <Movimentar inicial={selecionado} />}
      {aba === 'historico' && <Historico />}
    </>
  )
}

/* ---------------- Alertas ---------------- */

function Alertas({ gestor, onRepor }) {
  const [dias, setDias] = useState(7)
  const [alertas, setAlertas] = useState(null)
  const [resumo, setResumo] = useState(null)
  const [erro, setErro] = useState('')

  useEffect(() => {
    estoqueApi.alertas(dias).then(setAlertas).catch((e) => setErro(mensagemErro(e)))
  }, [dias])
  useEffect(() => {
    if (gestor) estoqueApi.resumo().then(setResumo).catch(() => {})
  }, [gestor])

  if (erro) return <p className="erro" role="alert">{erro}</p>
  if (!alertas) return <p className="muted">Carregando…</p>

  return (
    <>
      {resumo && (
        <dl className="resumo">
          <div><dt>Produtos ativos</dt><dd>{resumo.totalProdutos}</dd></div>
          <div><dt>Valor em estoque (custo)</dt><dd>{moeda(resumo.valorCusto)}</dd></div>
          <div><dt>Valor em estoque (venda)</dt><dd>{moeda(resumo.valorVenda)}</dd></div>
        </dl>
      )}

      <Secao titulo="Estoque baixo" itens={alertas.estoqueBaixo} onRepor={onRepor}
             vazio="Nenhum produto abaixo do estoque mínimo."
             coluna="Mínimo" valor={(i) => `${numero(i.estoqueMinimo)} ${i.unidade}`} />
      <Secao titulo="Vencidos com saldo em estoque" itens={alertas.vencidos} onRepor={onRepor}
             vazio="Nenhum produto vencido em estoque."
             coluna="Venceu em" valor={(i) => dataBr(i.validade)} acao="Dar baixa" />
      <div className="cabecalho secao-cab">
        <h3>Vencendo nos próximos</h3>
        <select aria-label="Janela de validade" value={dias} onChange={(e) => setDias(Number(e.target.value))}>
          {[7, 15, 30].map((d) => <option key={d} value={d}>{d} dias</option>)}
        </select>
      </div>
      <Secao itens={alertas.vencendo} onRepor={onRepor} vazio="Nada vence nesse período."
             coluna="Validade" valor={(i) => {
               const d = diasAte(i.validade)
               return `${dataBr(i.validade)} (${d === 0 ? 'hoje' : `em ${d} d`})`
             }} acao="Dar baixa" />
    </>
  )
}

function Secao({ titulo, itens, coluna, valor, onRepor, vazio, acao = 'Repor' }) {
  return (
    <section className="secao">
      {titulo && <h3>{titulo} <span className="muted">({itens.length})</span></h3>}
      <div className="rolagem">
        <table className="tabela">
          <thead><tr><th>Produto</th><th>Em estoque</th><th>{coluna}</th><th></th></tr></thead>
          <tbody>
            {itens.map((i) => (
              <tr key={i.id}>
                <td>{i.nome}<small className="sub">{i.codigoBarras}</small></td>
                <td className="num">{numero(i.estoqueAtual)} {i.unidade}</td>
                <td className="num">{valor(i)}</td>
                <td className="acoes"><button className="sec" onClick={() => onRepor(i)}>{acao}</button></td>
              </tr>
            ))}
            {itens.length === 0 && <tr><td colSpan="4" className="vazio">{vazio}</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  )
}

/* ---------------- Movimentar ---------------- */

const ROTULO_QTD = {
  ENTRADA: 'Quantidade que entrou',
  SAIDA: 'Quantidade que saiu',
  AJUSTE: 'Saldo contado na prateleira',
}

function Movimentar({ inicial }) {
  const [busca, setBusca] = useState('')
  const [resultados, setResultados] = useState([])
  const [produto, setProduto] = useState(inicial)
  const [tipo, setTipo] = useState(inicial?.validade && diasAte(inicial.validade) <= 7 ? 'SAIDA' : 'ENTRADA')
  const [quantidade, setQuantidade] = useState('')
  const [motivo, setMotivo] = useState('')
  const [erro, setErro] = useState('')
  const [ok, setOk] = useState('')
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    const termo = busca.trim()
    if (produto || termo.length < 2) { setResultados([]); return }
    const t = setTimeout(() => {
      produtosApi.listar({ busca: termo, tamanho: 6 }).then((r) => setResultados(r.itens)).catch(() => {})
    }, 250)
    return () => clearTimeout(t)
  }, [busca, produto])

  function escolher(p) { setProduto(p); setBusca(''); setResultados([]); setErro(''); setOk('') }

  // Leitor de código de barras envia o código seguido de Enter.
  function aoApertarEnter(e) {
    if (e.key !== 'Enter') return
    e.preventDefault()
    const exato = resultados.find((p) => p.codigoBarras === busca.trim())
    if (exato) escolher(exato)
    else if (resultados.length === 1) escolher(resultados[0])
  }

  async function enviar(e) {
    e.preventDefault()
    setErro(''); setOk(''); setEnviando(true)
    try {
      const m = await estoqueApi.movimentar({
        produtoId: produto.id, tipo, quantidade: Number(quantidade), motivo: motivo || null,
      })
      setOk(`${TIPOS[tipo]} registrada. Saldo de ${m.produtoNome}: ${numero(m.saldoAnterior)} → ${numero(m.saldoPosterior)} ${m.unidade}.`)
      setProduto(null); setQuantidade(''); setMotivo('')
    } catch (err) { setErro(mensagemErro(err)) } finally { setEnviando(false) }
  }

  const atual = produto ? Number(produto.estoqueAtual) : 0
  const q = Number(quantidade)
  const depois = quantidade === '' ? null : tipo === 'ENTRADA' ? atual + q : tipo === 'SAIDA' ? atual - q : q
  const fracionavel = produto && ['KG', 'L'].includes(produto.unidade)
  const motivoObrigatorio = tipo !== 'ENTRADA'

  return (
    <form className="mov" onSubmit={enviar}>
      {ok && <p className="ok" role="status">{ok}</p>}

      {!produto ? (
        <>
          <label htmlFor="busca">Produto</label>
          <input id="busca" type="search" autoFocus autoComplete="off"
                 placeholder="Digite o nome ou passe o leitor no código de barras"
                 value={busca} onChange={(e) => setBusca(e.target.value)} onKeyDown={aoApertarEnter} />
          {resultados.length > 0 && (
            <ul className="achados">
              {resultados.map((p) => (
                <li key={p.id}>
                  <button type="button" className="sec" onClick={() => escolher(p)}>
                    {p.nome}<small className="sub">{p.codigoBarras} · estoque {numero(p.estoqueAtual)} {p.unidade}</small>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {busca.trim().length >= 2 && resultados.length === 0 && <p className="muted">Nenhum produto encontrado.</p>}
        </>
      ) : (
        <>
          <div className="produto-sel">
            <div>
              <strong>{produto.nome}</strong>
              <small className="sub">{produto.codigoBarras} · estoque atual {numero(produto.estoqueAtual)} {produto.unidade}</small>
            </div>
            <button type="button" className="sec" onClick={() => setProduto(null)}>Trocar produto</button>
          </div>

          <fieldset className="tipos">
            <legend>O que aconteceu?</legend>
            {['ENTRADA', 'SAIDA', 'AJUSTE'].map((t) => (
              <label key={t} className={tipo === t ? 'marcado' : ''}>
                <input type="radio" name="tipo" value={t} checked={tipo === t} onChange={() => setTipo(t)} />
                {TIPOS[t]}
              </label>
            ))}
          </fieldset>

          <label htmlFor="qtd">{ROTULO_QTD[tipo]} ({produto.unidade})</label>
          <input id="qtd" type="number" required min={tipo === 'AJUSTE' ? '0' : fracionavel ? '0.001' : '1'}
                 step={fracionavel ? '0.001' : '1'} value={quantidade} onChange={(e) => setQuantidade(e.target.value)} />
          {depois !== null && (
            <p className={depois < 0 ? 'erro' : 'muted'}>
              {depois < 0 ? 'Quantidade maior que o estoque disponível.' : `Saldo depois: ${numero(depois)} ${produto.unidade}`}
            </p>
          )}

          <label htmlFor="mot">Motivo{motivoObrigatorio ? '' : ' (opcional)'}</label>
          <input id="mot" maxLength={200} required={motivoObrigatorio} value={motivo}
                 placeholder={tipo === 'SAIDA' ? 'Ex.: produto vencido, avaria, consumo interno' : tipo === 'AJUSTE' ? 'Ex.: inventário' : 'Ex.: nota fiscal 1234'}
                 onChange={(e) => setMotivo(e.target.value)} />

          {erro && <p className="erro" role="alert">{erro}</p>}
          <button type="submit" disabled={enviando}>{enviando ? 'Registrando…' : `Registrar ${TIPOS[tipo].toLowerCase()}`}</button>
        </>
      )}
    </form>
  )
}

/* ---------------- Histórico ---------------- */

function Historico() {
  const [dados, setDados] = useState({ itens: [], totalPaginas: 0, total: 0 })
  const [tipo, setTipo] = useState('')
  const [pagina, setPagina] = useState(0)
  const [erro, setErro] = useState('')

  const carregar = useCallback(() => {
    estoqueApi.historico({ tipo: tipo || undefined, pagina, tamanho: 15 }).then(setDados).catch((e) => setErro(mensagemErro(e)))
  }, [tipo, pagina])
  useEffect(carregar, [carregar])

  return (
    <>
      <div className="filtros">
        <select aria-label="Filtrar por tipo" value={tipo} onChange={(e) => { setTipo(e.target.value); setPagina(0) }}>
          <option value="">Todos os tipos</option>
          {Object.entries(TIPOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <span className="muted">{dados.total} {dados.total === 1 ? 'registro' : 'registros'}</span>
      </div>
      {erro && <p className="erro" role="alert">{erro}</p>}
      <div className="rolagem">
        <table className="tabela">
          <thead><tr><th>Data</th><th>Produto</th><th>Tipo</th><th>Quantidade</th><th>Saldo</th><th>Motivo</th><th>Usuário</th></tr></thead>
          <tbody>
            {dados.itens.map((m) => {
              const q = Number(m.quantidade)
              return (
                <tr key={m.id}>
                  <td className="num">{dataHora(m.criadoEm)}</td>
                  <td>{m.produtoNome}</td>
                  <td>{TIPOS[m.tipo]}</td>
                  <td className={`num ${q < 0 ? 'neg' : 'pos'}`}>{q > 0 ? '+' : ''}{numero(q)} {m.unidade}</td>
                  <td className="num">{numero(m.saldoAnterior)} → {numero(m.saldoPosterior)}</td>
                  <td>{m.motivo || '—'}</td>
                  <td>{m.usuarioNome}</td>
                </tr>
              )
            })}
            {dados.itens.length === 0 && <tr><td colSpan="7" className="vazio">Nenhuma movimentação registrada.</td></tr>}
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
    </>
  )
}
