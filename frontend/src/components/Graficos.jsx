import { useState } from 'react'

/**
 * Gráficos leves em HTML/CSS (sem biblioteca). Cada barra tem área de toque maior que a marca
 * e mostra uma dica ao passar o mouse ou focar com o teclado.
 */

function Dica({ dica }) {
  if (!dica) return null
  return (
    <div className="g-dica" role="status" style={{ left: `${dica.x}%` }}>
      <strong>{dica.titulo}</strong>
      {dica.linhas.map(([k, v]) => <span key={k}>{k}: <b>{v}</b></span>)}
    </div>
  )
}

/** Colunas verticais de uma série. dados: [{ rotulo, valor, detalhe?: [[k, v]] }] */
export function Colunas({ dados, formatar = String, titulo, altura = 180, rotuloEixo = (d) => d.rotulo, marcarCada = 1 }) {
  const [dica, setDica] = useState(null)
  const max = Math.max(...dados.map((d) => Number(d.valor)), 0)
  const n = dados.length
  return (
    <figure className="grafico" aria-label={titulo}>
      <div className="g-area" style={{ height: altura }} onMouseLeave={() => setDica(null)}>
        <span className="g-max">{max > 0 ? formatar(max) : ''}</span>
        {dados.map((d, i) => {
          const h = max > 0 ? (Number(d.valor) / max) * 100 : 0
          const mostrar = () => setDica({
            x: ((i + 0.5) / n) * 100, titulo: d.rotulo,
            linhas: [['Valor', formatar(d.valor)], ...(d.detalhe ?? [])],
          })
          return (
            <button key={i} type="button" className="g-col" aria-label={`${d.rotulo}: ${formatar(d.valor)}`}
                    onMouseEnter={mostrar} onFocus={mostrar} onBlur={() => setDica(null)}>
              <span className="g-barra" style={{ height: `${h}%` }} data-zero={Number(d.valor) === 0 || undefined} />
            </button>
          )
        })}
        <Dica dica={dica} />
      </div>
      <div className="g-eixo">
        {dados.map((d, i) => <span key={i}>{i % marcarCada === 0 ? rotuloEixo(d) : ''}</span>)}
      </div>
    </figure>
  )
}

/** Barras divergentes: positivo para cima, negativo para baixo (fluxo de caixa). */
export function Divergente({ dados, formatar = String, titulo, altura = 200, rotulos = ['Entradas', 'Saídas'], marcarCada = 1 }) {
  const [dica, setDica] = useState(null)
  const max = Math.max(...dados.flatMap((d) => [Number(d.positivo), Number(d.negativo)]), 0)
  const n = dados.length
  return (
    <figure className="grafico" aria-label={titulo}>
      <ul className="g-legenda">
        <li><i className="g-cor pos" />{rotulos[0]}</li>
        <li><i className="g-cor neg" />{rotulos[1]}</li>
      </ul>
      <div className="g-area g-div" style={{ height: altura }} onMouseLeave={() => setDica(null)}>
        {dados.map((d, i) => {
          const hp = max > 0 ? (Number(d.positivo) / max) * 100 : 0
          const hn = max > 0 ? (Number(d.negativo) / max) * 100 : 0
          const mostrar = () => setDica({
            x: ((i + 0.5) / n) * 100, titulo: d.rotulo,
            linhas: [[rotulos[0], formatar(d.positivo)], [rotulos[1], formatar(d.negativo)], ...(d.detalhe ?? [])],
          })
          return (
            <button key={i} type="button" className="g-col"
                    aria-label={`${d.rotulo}: ${rotulos[0]} ${formatar(d.positivo)}, ${rotulos[1]} ${formatar(d.negativo)}`}
                    onMouseEnter={mostrar} onFocus={mostrar} onBlur={() => setDica(null)}>
              <span className="g-metade cima"><span className="g-barra pos" style={{ height: `${hp}%` }} /></span>
              <span className="g-metade baixo"><span className="g-barra neg" style={{ height: `${hn}%` }} /></span>
            </button>
          )
        })}
        <Dica dica={dica} />
      </div>
      <div className="g-eixo">
        {dados.map((d, i) => <span key={i}>{i % marcarCada === 0 ? d.eixo ?? d.rotulo : ''}</span>)}
      </div>
    </figure>
  )
}

/** Ranking em barras horizontais com valor escrito ao lado. */
export function Ranking({ dados, formatar = String, titulo, vazio = 'Sem dados no período.' }) {
  const max = Math.max(...dados.map((d) => Number(d.valor)), 0)
  if (dados.length === 0) return <p className="muted">{vazio}</p>
  return (
    <ul className="ranking" aria-label={titulo}>
      {dados.map((d, i) => (
        <li key={i} title={d.dica}>
          <span className="r-nome">{d.rotulo}{d.sub && <small className="sub">{d.sub}</small>}</span>
          <span className="r-trilho"><span className="r-barra" style={{ width: `${max > 0 ? (Number(d.valor) / max) * 100 : 0}%` }} /></span>
          <span className="r-valor">{formatar(d.valor)}</span>
        </li>
      ))}
    </ul>
  )
}

const DIAS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

/** Mapa de calor dia da semana × hora (um tom, do claro ao escuro). */
export function MapaCalor({ dados, formatar = String }) {
  const horas = dados.map((d) => d.hora)
  const ini = horas.length ? Math.min(...horas) : 7
  const fim = horas.length ? Math.max(...horas) : 22
  const max = Math.max(...dados.map((d) => d.vendas), 0)
  const cel = new Map(dados.map((d) => [`${d.diaSemana}-${d.hora}`, d]))
  const faixa = Array.from({ length: fim - ini + 1 }, (_, i) => ini + i)
  return (
    <div className="rolagem">
      <table className="calor">
        <thead><tr><th></th>{faixa.map((h) => <th key={h} scope="col">{h}h</th>)}</tr></thead>
        <tbody>
          {DIAS.map((nome, i) => (
            <tr key={nome}>
              <th scope="row">{nome}</th>
              {faixa.map((h) => {
                const d = cel.get(`${i + 1}-${h}`)
                const n = d?.vendas ?? 0
                const nivel = max > 0 && n > 0 ? Math.ceil((n / max) * 5) : 0
                return (
                  <td key={h} className={`n${nivel}`} tabIndex={n ? 0 : undefined}
                      title={`${nome} ${h}h: ${n} ${n === 1 ? 'venda' : 'vendas'}${d ? ` · ${formatar(d.faturamento)}` : ''}`}>
                    {n || ''}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="muted pequeno">Número de vendas concluídas. Quanto mais escuro, maior o movimento.</p>
    </div>
  )
}

/** Indicador com comparação. `melhorQuandoSobe=false` inverte a cor (ex.: despesas). */
export function Indicador({ rotulo, valor, comparacao, rotuloComparacao, melhorQuandoSobe = true, destaque, negativo }) {
  const temVar = comparacao != null && Number.isFinite(comparacao)
  const bom = temVar && (comparacao >= 0) === melhorQuandoSobe
  return (
    <div className={`indicador${destaque ? ' destaque' : ''}${negativo ? ' negativo' : ''}`}>
      <span className="i-rotulo">{rotulo}</span>
      <strong className="i-valor">{valor}</strong>
      {temVar ? (
        <span className={`i-var ${comparacao === 0 ? '' : bom ? 'bom' : 'ruim'}`}>
          {comparacao > 0 ? '▲' : comparacao < 0 ? '▼' : '■'} {Math.abs(comparacao).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% {rotuloComparacao}
        </span>
      ) : rotuloComparacao ? <span className="i-var">sem base {rotuloComparacao}</span> : null}
    </div>
  )
}
