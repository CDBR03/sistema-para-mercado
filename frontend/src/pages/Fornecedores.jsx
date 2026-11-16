import { useCallback, useEffect, useState } from 'react'
import { fornecedoresApi, mensagemErro } from '../api/recursos'
import Modal from '../components/Modal'
import { cnpjFmt } from '../utils'

const VAZIO = { razaoSocial: '', cnpj: '', telefone: '', email: '' }

export default function Fornecedores() {
  const [itens, setItens] = useState([])
  const [busca, setBusca] = useState('')
  const [termo, setTermo] = useState('')
  const [form, setForm] = useState(null)
  const [erro, setErro] = useState('')
  const [erroForm, setErroForm] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setTermo(busca), 300)
    return () => clearTimeout(t)
  }, [busca])

  const carregar = useCallback(() => {
    fornecedoresApi.listar({ busca: termo }).then(setItens).catch((e) => setErro(mensagemErro(e)))
  }, [termo])
  useEffect(carregar, [carregar])

  const campo = (k) => ({ value: form[k] ?? '', onChange: (e) => setForm({ ...form, [k]: e.target.value }) })

  async function salvar(e) {
    e.preventDefault()
    setErroForm('')
    const { id, ...dados } = form
    try {
      id ? await fornecedoresApi.atualizar(id, dados) : await fornecedoresApi.criar(dados)
      setForm(null)
      carregar()
    } catch (err) { setErroForm(mensagemErro(err)) }
  }

  async function inativar(f) {
    if (!window.confirm(`Remover o fornecedor “${f.razaoSocial}” da lista?`)) return
    setErro('')
    try { await fornecedoresApi.excluir(f.id); carregar() } catch (err) { setErro(mensagemErro(err)) }
  }

  return (
    <>
      <div className="cabecalho">
        <h2>Fornecedores</h2>
        <button onClick={() => { setErroForm(''); setForm(VAZIO) }}>Novo fornecedor</button>
      </div>
      <div className="filtros">
        <input type="search" placeholder="Buscar por razão social" aria-label="Buscar fornecedor"
               value={busca} onChange={(e) => setBusca(e.target.value)} />
      </div>
      {erro && <p className="erro" role="alert">{erro}</p>}

      <div className="rolagem">
        <table className="tabela">
          <thead><tr><th>Razão social</th><th>CNPJ</th><th>Telefone</th><th>E-mail</th><th></th></tr></thead>
          <tbody>
            {itens.map((f) => (
              <tr key={f.id}>
                <td>{f.razaoSocial}</td>
                <td>{cnpjFmt(f.cnpj)}</td>
                <td>{f.telefone || '—'}</td>
                <td>{f.email || '—'}</td>
                <td className="acoes">
                  <button className="sec" onClick={() => { setErroForm(''); setForm(f) }}>Editar</button>
                  <button className="sec perigo" onClick={() => inativar(f)}>Remover</button>
                </td>
              </tr>
            ))}
            {itens.length === 0 && <tr><td colSpan="5" className="vazio">Nenhum fornecedor encontrado.</td></tr>}
          </tbody>
        </table>
      </div>

      {form && (
        <Modal titulo={form.id ? 'Editar fornecedor' : 'Novo fornecedor'} onFechar={() => setForm(null)}>
          <form onSubmit={salvar}>
            <label htmlFor="rs">Razão social</label>
            <input id="rs" required maxLength={160} autoFocus {...campo('razaoSocial')} />
            <label htmlFor="cnpj">CNPJ (opcional)</label>
            <input id="cnpj" inputMode="numeric" placeholder="Somente números" {...campo('cnpj')} />
            <label htmlFor="tel">Telefone</label>
            <input id="tel" maxLength={20} {...campo('telefone')} />
            <label htmlFor="em">E-mail</label>
            <input id="em" type="email" {...campo('email')} />
            {erroForm && <p className="erro" role="alert">{erroForm}</p>}
            <div className="botoes">
              <button type="button" className="sec" onClick={() => setForm(null)}>Cancelar</button>
              <button type="submit">Salvar fornecedor</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}
