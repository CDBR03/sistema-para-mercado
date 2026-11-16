import http from './http'

const recurso = (base) => ({
  listar: (params) => http.get(base, { params }).then((r) => r.data),
  criar: (dados) => http.post(base, dados).then((r) => r.data),
  atualizar: (id, dados) => http.put(`${base}/${id}`, dados).then((r) => r.data),
  excluir: (id) => http.delete(`${base}/${id}`),
})

export const categoriasApi = recurso('/api/categorias')
export const fornecedoresApi = recurso('/api/fornecedores')
export const produtosApi = {
  ...recurso('/api/produtos'),
  porCodigo: (codigo) => http.get(`/api/produtos/codigo/${encodeURIComponent(codigo)}`).then((r) => r.data),
}

export const mensagemErro = (err) =>
  err.response?.data?.message ??
  (err.response?.status === 403 ? 'Seu perfil não tem permissão para esta ação.' : 'Não foi possível concluir a operação.')

export const estoqueApi = {
  alertas: (dias = 7) => http.get('/api/estoque/alertas', { params: { dias } }).then((r) => r.data),
  resumo: () => http.get('/api/estoque/resumo').then((r) => r.data),
  historico: (params) => http.get('/api/estoque/movimentacoes', { params }).then((r) => r.data),
  movimentar: (dados) => http.post('/api/estoque/movimentacoes', dados).then((r) => r.data),
}

export const vendasApi = {
  criar: (dados) => http.post('/api/vendas', dados).then((r) => r.data),
  listar: (params) => http.get('/api/vendas', { params }).then((r) => r.data),
  periodo: (params) => http.get('/api/vendas/periodo', { params }).then((r) => r.data),
  buscar: (id) => http.get(`/api/vendas/${id}`).then((r) => r.data),
  cancelar: (id, motivo) => http.post(`/api/vendas/${id}/cancelamento`, { motivo }).then((r) => r.data),
}

export const comprasApi = {
  listar: (params) => http.get('/api/compras', { params }).then((r) => r.data),
  buscar: (id) => http.get(`/api/compras/${id}`).then((r) => r.data),
  sugestao: (fornecedorId) => http.get('/api/compras/sugestao', { params: { fornecedorId } }).then((r) => r.data),
  criar: (dados) => http.post('/api/compras', dados).then((r) => r.data),
  atualizar: (id, dados) => http.put(`/api/compras/${id}`, dados).then((r) => r.data),
  receber: (id, dados) => http.post(`/api/compras/${id}/recebimento`, dados).then((r) => r.data),
  cancelar: (id, motivo) => http.post(`/api/compras/${id}/cancelamento`, { motivo }).then((r) => r.data),
}

export const financeiroApi = {
  listar: (params) => http.get('/api/financeiro/contas', { params }).then((r) => r.data),
  criar: (dados) => http.post('/api/financeiro/contas', dados).then((r) => r.data),
  atualizar: (id, dados) => http.put(`/api/financeiro/contas/${id}`, dados).then((r) => r.data),
  baixar: (id, dados) => http.post(`/api/financeiro/contas/${id}/baixa`, dados).then((r) => r.data),
  estornar: (id) => http.delete(`/api/financeiro/contas/${id}/baixa`).then((r) => r.data),
  cancelar: (id, motivo) => http.post(`/api/financeiro/contas/${id}/cancelamento`, { motivo }).then((r) => r.data),
  resumo: () => http.get('/api/financeiro/resumo').then((r) => r.data),
  fluxo: (params) => http.get('/api/financeiro/fluxo-caixa', { params }).then((r) => r.data),
}

const rel = (nome) => (params) => http.get(`/api/relatorios/${nome}`, { params }).then((r) => r.data)
export const relatoriosApi = {
  vendas: rel('vendas'), curvaAbc: rel('curva-abc'), categorias: rel('categorias'), operadores: rel('operadores'),
  pagamentos: rel('pagamentos'), horarios: rel('horarios'), dre: rel('dre'),
}

export const dashboardApi = {
  gestao: () => http.get('/api/dashboard').then((r) => r.data),
  meuDia: () => http.get('/api/dashboard/meu-dia').then((r) => r.data),
}
