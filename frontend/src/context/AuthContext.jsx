import { createContext, useContext, useState } from 'react'
import http, { TOKEN_KEY } from '../api/http'

const USER_KEY = 'mercado.user'
const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem(USER_KEY)) } catch { return null }
  })

  async function login(email, senha) {
    const { data } = await http.post('/api/auth/login', { email, senha })
    localStorage.setItem(TOKEN_KEY, data.token)
    localStorage.setItem(USER_KEY, JSON.stringify(data.usuario))
    setUser(data.usuario)
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    setUser(null)
  }

  return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
