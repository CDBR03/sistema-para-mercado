import { useCallback, useEffect, useState } from 'react'
import { categoriasApi, fornecedoresApi, mensagemErro, produtosApi } from '../api/recursos'
import Modal from '../components/Modal'
import { dataBr, diasAte, moeda, numero } from '../utils'

const UNIDADES = ['UN', 'KG', 'L', 'CX', 'PCT']
const VAZIO = {
  codigoBarras: '', nome: '', categoriaId: '', fornecedorId: '', unidade: 'UN',
  precoCusto: '', precoVenda: '', estoqueMinimo: '0', validade: '',
}

function AvisoValidade({ iso }) {
  const dias = diasAte(iso)
  if (dias === null) return '—'
  if (dias < 0) return <>{dataBr(iso)} <span className="selo critico">Vencido</span></>
  if (dias <= 7) return <>{dataBr(iso)} <span className="selo alerta">{dias === 0 ? 'Vence hoje' : `Vence em ${dias} d`}</span></>
  return dataBr(iso)
}

export default function Produtos() {
  const [dados, setDados] = useState({ itens: [], pagina: 0, totalPaginas: 0, total: 0 })
  const [busca, setBusca] = useState('')
  const [termo, setTermo] = useState('')
  const [pagina, setPagina] = useState(0)
  const [categorias, setCategorias] = useState([])
  const [fornecedores, setFornecedores] = useState([])
  const [form, setForm] = useState(null)
  const [erro, setErro] = useState('')
  const [erroForm, setErroForm] = useState('')

  useEffect(() => {
    categoriasApi.listar().then(setCategorias).catch(() => {})
    fornecedoresApi.listar({ busca: '' }).then(setFornecedores).catch(() => {})
  }, [])

  useEffect(() => {
    const t = setTimeout(() => { setTermo(busca); setPagina(0) }, 300)
    return () => clearTimeout(t)
  }, [busca])

  const carregar = useCallback(() => {
    produtosApi.listar({ busca: termo, pagina, tamanho: 10 }).then(setDados).catch((e) => setErro(mensagemErro(e)))
  }, [termo, pagina])
  useEffect(carregar, [carregar])

  const campo = (k) => ({ value: form[k] ?? '', onChange: (e) => setForm({ ...form, [k]: e.target.value }) })

  function editar(p) {
    setErroForm('')
    setForm({
      id: p.id, codigoBarras: p.codigoBarras, nome: p.nome,
      categoriaId: String(p.categoriaId), fornecedorId: p.fornecedorId ? String(p.fornecedorId) : '',
      unidade: p.unidade, precoCusto: String(p.precoCusto), precoVenda: String(p.precoVenda),
      estoqueMinimo: String(p.estoqueMinimo), validade: p.validade ?? '',
    })
  }

  async function salvar(e) {
    e.preventDefault()
    setErroForm('')
    const payload = {
      codigoBarras: form.codigoBarras, nome: form.nome, unidade: form.unidade,
      categoriaId: Number(form.categoriaId),
      fornecedorId: form.fornecedorId ? Number(form.fornecedorId) : null,
      precoCusto: Number(form.precoCusto), precoVenda: Number(form.precoVenda),
      estoqueMinimo: Number(form.estoqueMinimo), validade: form.validade || null,
    }
    try {
      form.id ? await produtosApi.atualizar(form.id, payload) : await produtosApi.criar(payload)
      setForm(null)
      carregar()
    } catch (err) { setErroForm(mensagemErro(err)) }
  }

  async function inativar(p) {
    if (!window.confirm(`Remover “${p.nome}” do catálogo? O histórico de vendas será mantido.`)) return
    setErro('')
    try { await produtosApi.excluir(p.id); carregar() } catch (err) { setErro(mensagemErro(err)) }
  }

  const custo = Number(form?.precoCusto), venda = Number(form?.precoVenda)
  const margem = venda > 0 && custo >= 0 && form?.precoCusto !== '' ? ((venda - custo) / venda) * 100 : null

  return (
    <>
      <div className="cabecalho">
        <h2>Produtos</h2>
        <button onClick={() => { setErroForm(''); setForm(VAZIO) }}>Novo produto</button>
      </div>
      <div className="filtros">
        <input type="search" placeholder="Buscar por nome ou código de barras" aria-label="Buscar produto"
               value={busca} onChange={(e) => setBusca(e.target.value)} />
        <span className="muted">{dados.total} {dados.total === 1 ? 'produto' : 'produtos'}</span>
      </div>
      {erro && <p className="erro" role="alert">{erro}</p>}

      <div className="rolagem">
        <table className="tabela">
          <thead>
            <tr><th>Código</th><th>Produto</th><th>Preço</th><th>Estoque</th><th>Validade</th><th></th></tr>
          </thead>
          <tbody>
            {dados.itens.map((p) => {
              const baixo = Number(p.estoqueAtual) <= Number(p.estoqueMinimo)
              return (
                <tr key={p.id}>
                  <td className="num">{p.codigoBarras}</td>
                  <td>{p.nome}<small className="sub">{p.categoriaNome}</small></td>
                  <td className="num">{moeda(p.precoVenda)}</td>
                  <td className="num">{numero(p.estoqueAtual)} {p.unidade}
                    {baixo && <span className="selo alerta">Baixo</span>}</td>
                  <td><AvisoValidade iso={p.validade} /></td>
                  <td className="acoes">
                    <button className="sec" onClick={() => editar(p)}>Editar</button>
                    <button className="sec perigo" onClick={() => inativar(p)}>Remover</button>
                  </td>
                </tr>
              )
            })}
            {dados.itens.length === 0 && <tr><td colSpan="6" className="vazio">Nenhum produto encontrado.</td></tr>}
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

      {form && (
        <Modal titulo={form.id ? 'Editar produto' : 'Novo produto'} onFechar={() => setForm(null)}>
          <form onSubmit={salvar} className="grade">
            <div className="col2">
              <label htmlFor="cb">Código de barras</label>
              <input id="cb" required maxLength={30} inputMode="numeric" autoFocus {...campo('codigoBarras')} />
            </div>
            <div className="col2">
              <label htmlFor="un">Unidade</label>
              <select id="un" {...campo('unidade')}>{UNIDADES.map((u) => <option key={u}>{u}</option>)}</select>
            </div>
            <div className="col4">
              <label htmlFor="nm">Nome do produto</label>
              <input id="nm" required maxLength={160} {...campo('nome')} />
            </div>
            <div className="col2">
              <label htmlFor="ct">Categoria</label>
              <select id="ct" required {...campo('categoriaId')}>
                <option value="">Selecione…</option>
                {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
            <div className="col2">
              <label htmlFor="fn">Fornecedor</label>
              <select id="fn" {...campo('fornecedorId')}>
                <option value="">Nenhum</option>
                {fornecedores.map((f) => <option key={f.id} value={f.id}>{f.razaoSocial}</option>)}
              </select>
            </div>
            <div className="col2">
              <label htmlFor="pc">Preço de custo (R$)</label>
              <input id="pc" type="number" required min="0" step="0.01" {...campo('precoCusto')} />
            </div>
            <div className="col2">
              <label htmlFor="pv">Preço de venda (R$)</label>
              <input id="pv" type="number" required min="0.01" step="0.01" {...campo('precoVenda')} />
            </div>
            <div className="col2">
              <label htmlFor="em">Estoque mínimo</label>
              <input id="em" type="number" required min="0" step="0.001" {...campo('estoqueMinimo')} />
            </div>
            <div className="col2">
              <label htmlFor="vd">Validade</label>
              <input id="vd" type="date" {...campo('validade')} />
            </div>
            {margem !== null && <p className="muted col4">Margem sobre a venda: {margem.toFixed(1).replace('.', ',')}%</p>}
            <p className="muted col4">O estoque atual muda por entradas, saídas e vendas, não por esta tela.</p>
            {erroForm && <p className="erro col4" role="alert">{erroForm}</p>}
            <div className="botoes col4">
              <button type="button" className="sec" onClick={() => setForm(null)}>Cancelar</button>
              <button type="submit">Salvar produto</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}
