// `caminho: null` = módulo ainda não implementado (aparece como "Em breve" no painel).
export const MODULOS = [
  { nome: 'Frente de caixa', caminho: '/pdv', perfis: ['ADMIN', 'GERENTE', 'CAIXA'] },
  { nome: 'Produtos', caminho: '/produtos', perfis: ['ADMIN', 'GERENTE', 'ESTOQUISTA'] },
  { nome: 'Categorias', caminho: '/categorias', perfis: ['ADMIN', 'GERENTE', 'ESTOQUISTA'] },
  { nome: 'Fornecedores', caminho: '/fornecedores', perfis: ['ADMIN', 'GERENTE'] },
  { nome: 'Estoque', caminho: '/estoque', perfis: ['ADMIN', 'GERENTE', 'ESTOQUISTA'] },
  { nome: 'Vendas', caminho: '/vendas', perfis: ['ADMIN', 'GERENTE'] },
  { nome: 'Compras', caminho: '/compras', perfis: ['ADMIN', 'GERENTE', 'ESTOQUISTA'] },
  { nome: 'Financeiro', caminho: '/financeiro', perfis: ['ADMIN', 'GERENTE'] },
  { nome: 'Relatórios', caminho: '/relatorios', perfis: ['ADMIN', 'GERENTE'] },
  { nome: 'Usuários', caminho: null, perfis: ['ADMIN'] },
]
