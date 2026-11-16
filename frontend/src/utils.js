export const moeda = (v) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
export const numero = (v) => Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 3 })
export const dataBr = (iso) => (iso ? iso.split('-').reverse().join('/') : '—')

/** Dias entre hoje e a data ISO (negativo = já passou). */
export function diasAte(iso) {
  if (!iso) return null
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  return Math.round((new Date(iso + 'T00:00:00') - hoje) / 86400000)
}

export function cnpjFmt(c) {
  if (!c || c.length !== 14) return c || '—'
  return c.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
}

export const dataHora = (iso) =>
  new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

export const FORMAS = {
  DINHEIRO: 'Dinheiro', PIX: 'Pix', CARTAO_DEBITO: 'Cartão de débito', CARTAO_CREDITO: 'Cartão de crédito',
}

/** Data de hoje no fuso local, no formato AAAA-MM-DD (para campos <input type="date">). */
export const hojeIso = () => new Date().toLocaleDateString('sv-SE')

export const arredonda = (v) => Math.round((v + Number.EPSILON) * 100) / 100

export const pct = (v) => `${Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`

/** Soma dias a uma data ISO (AAAA-MM-DD) sem problemas de fuso. */
export function somaDias(iso, dias) {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() + dias)
  return d.toLocaleDateString('sv-SE')
}

/** Atalhos de período usados em relatórios e no fluxo de caixa. */
export function periodoPreset(chave) {
  const hoje = hojeIso()
  const [a, m] = hoje.split('-').map(Number)
  const iso = (ano, mes, dia) => new Date(ano, mes - 1, dia, 12).toLocaleDateString('sv-SE')
  switch (chave) {
    case 'hoje': return [hoje, hoje]
    case '7d': return [somaDias(hoje, -6), hoje]
    case '30d': return [somaDias(hoje, -29), hoje]
    case 'mes': return [iso(a, m, 1), hoje]
    case 'mesAnterior': return [iso(a, m - 1, 1), iso(a, m, 0)]
    case 'ano': return [iso(a, 1, 1), hoje]
    default: return [hoje, hoje]
  }
}
export const PRESETS = [['hoje', 'Hoje'], ['7d', '7 dias'], ['30d', '30 dias'], ['mes', 'Este mês'], ['mesAnterior', 'Mês anterior'], ['ano', 'Este ano']]

/** Gera e baixa um CSV (separador ";" e BOM para abrir certo no Excel em português). */
export function baixarCsv(nome, colunas, linhas) {
  const esc = (v) => {
    if (v == null) return ''
    const s = typeof v === 'number' ? String(v).replace('.', ',') : String(v)
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const corpo = [colunas.map((c) => esc(c[0])).join(';'),
    ...linhas.map((l) => colunas.map((c) => esc(c[1](l))).join(';'))].join('\r\n')
  const url = URL.createObjectURL(new Blob(['﻿' + corpo], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = nome.endsWith('.csv') ? nome : `${nome}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/** Variação percentual entre dois valores (null quando não há base de comparação). */
export function variacao(atual, anterior) {
  const a = Number(atual), b = Number(anterior)
  if (!b) return null
  return ((a - b) / b) * 100
}

export const CATEGORIAS_CONTA = {
  FORNECEDOR: 'Fornecedor (mercadoria)', ALUGUEL: 'Aluguel', ENERGIA: 'Energia', AGUA: 'Água', INTERNET: 'Internet/telefone',
  SALARIOS: 'Salários', IMPOSTOS: 'Impostos', MANUTENCAO: 'Manutenção', MARKETING: 'Marketing', TARIFAS: 'Tarifas bancárias',
  RECEITA_DIVERSA: 'Receita diversa', OUTROS: 'Outros',
}
