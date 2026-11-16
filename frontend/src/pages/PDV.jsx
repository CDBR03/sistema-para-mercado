import { useCallback, useEffect, useRef, useState } from 'react'
import { mensagemErro, produtosApi, vendasApi } from '../api/recursos'
import Cupom from '../components/Cupom'
import Modal from '../components/Modal'
import { useAuth } from '../context/AuthContext'
import { FORMAS, arredonda, moeda, numero } from '../utils'

const linhaTotal = (i) => arredonda(Number(i.produto.precoVenda) * Number(i.quantidade || 0))
const fracionavel = (p) => ['KG', 'L'].includes(p.unidade)

export default function PDV() {
  const { user } = useAuth()
  const [carrinho, setCarrinho] = useState([])
  const [entrada, setEntrada] = useState('')
  const [sugestoes, setSugestoes] = useState([])
  const [aviso, setAviso] = useState('')
  const [pagando, setPagando] = useState(false)
  const [concluida, setConcluida] = useState(null)
  const campo = useRef(null)

  const subtotal = arredonda(carrinho.reduce((s, i) => s + linhaTotal(i), 0))
  const itensValidos = carrinho.length > 0 && carrinho.every((i) => Number(i.quantidade) > 0)

  const adicionar = useCallback((produto, qtd = 1) => {
    setCarrinho((atual) => {
      const existe = atual.find((i) => i.produto.id === produto.id)
      if (existe) return atual.map((i) => i.produto.id === produto.id ? { ...i, quantidade: String(Number(i.quantidade) + qtd) } : i)
      return [...atual, { produto, quantidade: String(qtd) }]
    })
    setEntrada(''); setSugestoes([]); setAviso('')
    campo.current?.focus()
  }, [])

  // Aceita "3*789123..." (quantidade * código) e busca por nome com sugestões.
  const interpretar = (txt) => {
    const m = txt.trim().match(/^(\d+(?:[.,]\d+)?)\*(.+)$/)
    return m ? { qtd: Number(m[1].replace(',', '.')), termo: m[2].trim() } : { qtd: 1, termo: txt.trim() }
  }

  useEffect(() => {
    const { termo } = interpretar(entrada)
    if (termo.length < 2 || !/\D/.test(termo)) { setSugestoes([]); return }
    const t = setTimeout(() => produtosApi.listar({ busca: termo, tamanho: 6 }).then((r) => setSugestoes(r.itens)).catch(() => {}), 250)
    return () => clearTimeout(t)
  }, [entrada])

  async function aoEnviar(e) {
    e.preventDefault()
    const { qtd, termo } = interpretar(entrada)
    if (!termo) return
    setAviso('')
    try {
      adicionar(await produtosApi.porCodigo(termo), qtd)
    } catch (err) {
      if (err.response?.status !== 404) return setAviso(mensagemErro(err))
      try {
        const r = await produtosApi.listar({ busca: termo, tamanho: 6 })
        if (r.itens.length === 1) adicionar(r.itens[0], qtd)
        else if (r.itens.length === 0) setAviso(`Nenhum produto encontrado para “${termo}”.`)
        else setSugestoes(r.itens)
      } catch (e2) { setAviso(mensagemErro(e2)) }
    }
  }

  const alterarQtd = (id, v) => setCarrinho((c) => c.map((i) => i.produto.id === id ? { ...i, quantidade: v } : i))
  const remover = (id) => { setCarrinho((c) => c.filter((i) => i.produto.id !== id)); campo.current?.focus() }

  useEffect(() => {
    const atalho = (e) => {
      if (e.key === 'F2' && itensValidos && !concluida) { e.preventDefault(); setPagando(true) }
    }
    window.addEventListener('keydown', atalho)
    return () => window.removeEventListener('keydown', atalho)
  }, [itensValidos, concluida])

  function novaVenda() { setConcluida(null); setTimeout(() => campo.current?.focus(), 0) }

  return (
    <>
      <h2>Frente de caixa</h2>
      <div className="pdv">
        <section>
          <form onSubmit={aoEnviar} className="pdv-busca">
            <label htmlFor="cod">Código de barras ou nome do produto</label>
            <input id="cod" ref={campo} autoFocus autoComplete="off" value={entrada}
                   placeholder="Passe o leitor ou digite. Para várias unidades: 3*código"
                   onChange={(e) => setEntrada(e.target.value)} />
            {aviso && <p className="erro" role="alert">{aviso}</p>}
            {sugestoes.length > 0 && (
              <ul className="achados">
                {sugestoes.map((p) => (
                  <li key={p.id}>
                    <button type="button" className="sec" onClick={() => adicionar(p, interpretar(entrada).qtd)}>
                      {p.nome} <span className="muted">{moeda(p.precoVenda)}</span>
                      <small className="sub">{p.codigoBarras} · estoque {numero(p.estoqueAtual)} {p.unidade}</small>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </form>

          <div className="rolagem">
            <table className="tabela">
              <thead><tr><th>Produto</th><th>Preço</th><th>Qtd.</th><th>Total</th><th></th></tr></thead>
              <tbody>
                {carrinho.map((i) => {
                  const falta = Number(i.quantidade) > Number(i.produto.estoqueAtual)
                  return (
                    <tr key={i.produto.id}>
                      <td>{i.produto.nome}
                        {falta && <span className="selo critico">Estoque: {numero(i.produto.estoqueAtual)}</span>}</td>
                      <td className="num">{moeda(i.produto.precoVenda)}</td>
                      <td>
                        <input className="qtd" type="number" aria-label={`Quantidade de ${i.produto.nome}`}
                               min={fracionavel(i.produto) ? '0.001' : '1'} step={fracionavel(i.produto) ? '0.001' : '1'}
                               value={i.quantidade} onChange={(e) => alterarQtd(i.produto.id, e.target.value)} />
                        <span className="muted"> {i.produto.unidade}</span>
                      </td>
                      <td className="num">{moeda(linhaTotal(i))}</td>
                      <td className="acoes"><button className="sec perigo" onClick={() => remover(i.produto.id)}>Remover</button></td>
                    </tr>
                  )
                })}
                {carrinho.length === 0 && <tr><td colSpan="5" className="vazio">Caixa livre. Passe o primeiro produto no leitor.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="pdv-total">
          <span className="muted">Total da compra</span>
          <strong className="valor">{moeda(subtotal)}</strong>
          <span className="muted">{carrinho.length} {carrinho.length === 1 ? 'item' : 'itens'}</span>
          <button disabled={!itensValidos} onClick={() => setPagando(true)}>Finalizar venda (F2)</button>
          <button className="sec" disabled={carrinho.length === 0}
                  onClick={() => window.confirm('Limpar todo o carrinho?') && setCarrinho([])}>Cancelar compra</button>
        </aside>
      </div>

      {pagando && (
        <Pagamento subtotal={subtotal} podeDesconto={user.perfil !== 'CAIXA'}
                   itens={carrinho} onFechar={() => setPagando(false)}
                   onSucesso={(v) => { setPagando(false); setCarrinho([]); setConcluida(v) }} />
      )}

      {concluida && (
        <Modal titulo={`Venda nº ${concluida.id} concluída`} onFechar={novaVenda}>
          {Number(concluida.troco) > 0 && (
            <p className="troco-destaque">Troco: <strong>{moeda(concluida.troco)}</strong></p>
          )}
          <Cupom venda={concluida} />
          <div className="botoes">
            <button className="sec" onClick={() => window.print()}>Imprimir cupom</button>
            <button onClick={novaVenda}>Nova venda</button>
          </div>
        </Modal>
      )}
    </>
  )
}

function Pagamento({ subtotal, podeDesconto, itens, onFechar, onSucesso }) {
  const [desconto, setDesconto] = useState('')
  const [linhas, setLinhas] = useState([{ forma: 'DINHEIRO', valor: '' }])
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  const descontoNum = Math.min(Number(desconto) || 0, subtotal)
  const total = arredonda(subtotal - descontoNum)
  // Linha com valor vazio = "o que falta pagar".
  const efetivo = linhas.map((l, idx) => {
    if (l.valor !== '') return Number(l.valor)
    const outras = linhas.reduce((s, o, j) => (j !== idx && o.valor !== '' ? s + Number(o.valor) : s), 0)
    return Math.max(arredonda(total - outras), 0)
  })
  const pago = arredonda(efetivo.reduce((s, v) => s + v, 0))
  const falta = arredonda(total - pago)
  const troco = falta < 0 ? -falta : 0
  const pronto = total > 0 && falta <= 0

  const setLinha = (idx, parte) => setLinhas(linhas.map((l, j) => (j === idx ? { ...l, ...parte } : l)))

  async function confirmar() {
    setErro(''); setEnviando(true)
    try {
      const venda = await vendasApi.criar({
        itens: itens.map((i) => ({ produtoId: i.produto.id, quantidade: Number(i.quantidade) })),
        desconto: descontoNum,
        pagamentos: linhas.map((l, idx) => ({ forma: l.forma, valor: efetivo[idx] })).filter((p) => p.valor > 0),
      })
      onSucesso(venda)
    } catch (err) { setErro(mensagemErro(err)); setEnviando(false) }
  }

  return (
    <Modal titulo="Pagamento" onFechar={onFechar}>
      <dl className="resumo">
        <div><dt>Subtotal</dt><dd>{moeda(subtotal)}</dd></div>
        <div><dt>A pagar</dt><dd>{moeda(total)}</dd></div>
      </dl>

      {podeDesconto && (
        <>
          <label htmlFor="desc">Desconto (R$)</label>
          <input id="desc" type="number" min="0" step="0.01" value={desconto} onChange={(e) => setDesconto(e.target.value)} />
        </>
      )}

      <fieldset className="pagamentos">
        <legend>Formas de pagamento</legend>
        {linhas.map((l, idx) => (
          <div key={idx} className="pag-linha">
            <select aria-label="Forma de pagamento" value={l.forma} onChange={(e) => setLinha(idx, { forma: e.target.value })}>
              {Object.entries(FORMAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <input type="number" min="0" step="0.01" aria-label="Valor pago" value={l.valor}
                   placeholder={efetivo[idx].toFixed(2)} onChange={(e) => setLinha(idx, { valor: e.target.value })} />
            {linhas.length > 1 && <button type="button" className="sec perigo" onClick={() => setLinhas(linhas.filter((_, j) => j !== idx))}>Remover</button>}
          </div>
        ))}
        <button type="button" className="sec" onClick={() => setLinhas([...linhas, { forma: 'PIX', valor: '' }])}>Dividir em outra forma</button>
      </fieldset>

      {falta > 0 && <p className="erro">Faltam {moeda(falta)}</p>}
      {troco > 0 && <p className="troco-destaque">Troco: <strong>{moeda(troco)}</strong></p>}
      {erro && <p className="erro" role="alert">{erro}</p>}

      <div className="botoes">
        <button className="sec" onClick={onFechar}>Voltar ao carrinho</button>
        <button disabled={!pronto || enviando} onClick={confirmar}>{enviando ? 'Registrando…' : 'Confirmar pagamento'}</button>
      </div>
    </Modal>
  )
}
