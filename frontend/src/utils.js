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
