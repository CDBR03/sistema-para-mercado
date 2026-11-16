import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)

  if (user) return <Navigate to="/" replace />

  async function enviar(e) {
    e.preventDefault()
    setErro('')
    setCarregando(true)
    try {
      await login(email, senha)
      navigate('/', { replace: true })
    } catch (err) {
      setErro(err.response?.status === 401
        ? 'E-mail ou senha incorretos. Confira os dados e tente de novo.'
        : 'Não foi possível conectar ao servidor. Verifique se o back-end está rodando.')
    } finally {
      setCarregando(false)
    }
  }

  return (
    <main className="login">
      <section className="login-tag" aria-hidden="true">
        <p className="tag-price"><span>R$</span>9<sup>90</sup></p>
        <p className="tag-name">Café torrado 500 g</p>
        <p className="tag-code">7 891234 567890</p>
      </section>

      <section className="login-panel">
        <h1>Mercado</h1>
        <p className="muted">Entre para abrir o caixa, conferir o estoque ou ver as vendas do dia.</p>

        <form onSubmit={enviar}>
          <label htmlFor="email">E-mail</label>
          <input id="email" type="email" autoComplete="username" required
                 value={email} onChange={(e) => setEmail(e.target.value)} />

          <label htmlFor="senha">Senha</label>
          <input id="senha" type="password" autoComplete="current-password" required
                 value={senha} onChange={(e) => setSenha(e.target.value)} />

          {erro && <p className="erro" role="alert">{erro}</p>}

          <button type="submit" disabled={carregando}>{carregando ? 'Entrando…' : 'Entrar'}</button>
        </form>
      </section>
    </main>
  )
}
