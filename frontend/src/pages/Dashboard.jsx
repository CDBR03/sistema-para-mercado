import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { estoqueApi } from '../api/recursos'
import { useAuth } from '../context/AuthContext'
import { MODULOS } from '../modulos'

const VE_ESTOQUE = ['ADMIN', 'GERENTE', 'ESTOQUISTA']

export default function Dashboard() {
  const { user } = useAuth()
  const [alertas, setAlertas] = useState(null)
  const visiveis = MODULOS.filter((m) => m.perfis.includes(user.perfil))

  useEffect(() => {
    if (VE_ESTOQUE.includes(user.perfil)) estoqueApi.alertas(7).then(setAlertas).catch(() => {})
  }, [user.perfil])

  const partes = alertas && [
    [alertas.estoqueBaixo.length, 'com estoque baixo'],
    [alertas.vencidos.length, 'vencidos'],
    [alertas.vencendo.length, 'vencendo em 7 dias'],
  ].filter(([n]) => n > 0)

  return (
    <>
      <h2>Olá, {user.nome}</h2>
      {partes?.length > 0 && (
        <p className="aviso" role="status">
          Atenção ao estoque: {partes.map(([n, t]) => `${n} ${n === 1 ? 'produto' : 'produtos'} ${t}`).join(', ')}.{' '}
          <Link to="/estoque">Ver alertas</Link>
        </p>
      )}
      <p className="muted">Módulos liberados para o seu perfil. Os que aparecem como “em breve” chegam nas próximas etapas.</p>
      <ul className="modulos">
        {visiveis.map((m) => (
          <li key={m.nome} className={m.caminho ? '' : 'indisponivel'}>
            {m.caminho ? <Link to={m.caminho}>{m.nome}</Link> : <>{m.nome}<small>em breve</small></>}
          </li>
        ))}
      </ul>
    </>
  )
}
