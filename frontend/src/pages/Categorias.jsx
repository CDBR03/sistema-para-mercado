import { useCallback, useEffect, useState } from 'react'
import { categoriasApi, mensagemErro } from '../api/recursos'
import Modal from '../components/Modal'
import { useAuth } from '../context/AuthContext'

export default function Categorias() {
  const { user } = useAuth()
  const podeEditar = ['ADMIN', 'GERENTE', 'ESTOQUISTA'].includes(user.perfil)
  const [itens, setItens] = useState([])
  const [form, setForm] = useState(null)
  const [erro, setErro] = useState('')
  const [erroForm, setErroForm] = useState('')

  const carregar = useCallback(() => {
    categoriasApi.listar().then(setItens).catch((e) => setErro(mensagemErro(e)))
  }, [])
  useEffect(carregar, [carregar])

  async function salvar(e) {
    e.preventDefault()
    setErroForm('')
    try {
      const dados = { nome: form.nome }
      form.id ? await categoriasApi.atualizar(form.id, dados) : await categoriasApi.criar(dados)
      setForm(null)
      carregar()
    } catch (err) { setErroForm(mensagemErro(err)) }
  }

  async function excluir(c) {
    if (!window.confirm(`Excluir a categoria “${c.nome}”?`)) return
    setErro('')
    try { await categoriasApi.excluir(c.id); carregar() } catch (err) { setErro(mensagemErro(err)) }
  }

  return (
    <>
      <div className="cabecalho">
        <h2>Categorias</h2>
        {podeEditar && <button onClick={() => { setErroForm(''); setForm({ nome: '' }) }}>Nova categoria</button>}
      </div>
      {erro && <p className="erro" role="alert">{erro}</p>}

      <table className="tabela">
        <thead><tr><th>Nome</th><th></th></tr></thead>
        <tbody>
          {itens.map((c) => (
            <tr key={c.id}>
              <td>{c.nome}</td>
              <td className="acoes">
                {podeEditar && <>
                  <button className="sec" onClick={() => { setErroForm(''); setForm(c) }}>Editar</button>
                  <button className="sec perigo" onClick={() => excluir(c)}>Excluir</button>
                </>}
              </td>
            </tr>
          ))}
          {itens.length === 0 && <tr><td colSpan="2" className="vazio">Nenhuma categoria cadastrada.</td></tr>}
        </tbody>
      </table>

      {form && (
        <Modal titulo={form.id ? 'Editar categoria' : 'Nova categoria'} onFechar={() => setForm(null)}>
          <form onSubmit={salvar}>
            <label htmlFor="nome">Nome</label>
            <input id="nome" required maxLength={80} autoFocus value={form.nome}
                   onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            {erroForm && <p className="erro" role="alert">{erroForm}</p>}
            <div className="botoes">
              <button type="button" className="sec" onClick={() => setForm(null)}>Cancelar</button>
              <button type="submit">Salvar categoria</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}
