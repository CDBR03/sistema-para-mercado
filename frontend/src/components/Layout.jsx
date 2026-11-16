import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { MODULOS } from '../modulos'

export default function Layout() {
  const { user, logout } = useAuth()
  const links = MODULOS.filter((m) => m.caminho && m.perfis.includes(user.perfil))

  return (
    <div className="shell">
      <aside className="lateral">
        <strong className="marca">Mercado</strong>
        <nav>
          <NavLink to="/" end>Início</NavLink>
          {links.map((m) => <NavLink key={m.caminho} to={m.caminho}>{m.nome}</NavLink>)}
        </nav>
        <div className="usuario">
          <span>{user.nome}</span>
          <small>{user.perfil.toLowerCase()}</small>
          <button className="ghost" onClick={logout}>Sair</button>
        </div>
      </aside>
      <main className="conteudo"><Outlet /></main>
    </div>
  )
}
