import { Navigate, Route, Routes } from 'react-router-dom'
import PrivateRoute from './routes/PrivateRoute'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Produtos from './pages/Produtos'
import Categorias from './pages/Categorias'
import Fornecedores from './pages/Fornecedores'
import Estoque from './pages/Estoque'
import PDV from './pages/PDV'
import Vendas from './pages/Vendas'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/produtos" element={<PrivateRoute perfis={['ADMIN', 'GERENTE', 'ESTOQUISTA']}><Produtos /></PrivateRoute>} />
        <Route path="/categorias" element={<PrivateRoute perfis={['ADMIN', 'GERENTE', 'ESTOQUISTA']}><Categorias /></PrivateRoute>} />
        <Route path="/fornecedores" element={<PrivateRoute perfis={['ADMIN', 'GERENTE']}><Fornecedores /></PrivateRoute>} />
        <Route path="/estoque" element={<PrivateRoute perfis={['ADMIN', 'GERENTE', 'ESTOQUISTA']}><Estoque /></PrivateRoute>} />
        <Route path="/pdv" element={<PrivateRoute perfis={['ADMIN', 'GERENTE', 'CAIXA']}><PDV /></PrivateRoute>} />
        <Route path="/vendas" element={<PrivateRoute perfis={['ADMIN', 'GERENTE']}><Vendas /></PrivateRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
