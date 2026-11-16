import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

/** Exige login; se `perfis` for informado, restringe por perfil. */
export default function PrivateRoute({ perfis, children }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (perfis && !perfis.includes(user.perfil)) return <Navigate to="/" replace />
  return children
}
