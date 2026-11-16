import { FORMAS, dataHora, moeda, numero } from '../utils'

/** Cupom não fiscal, pensado para impressora térmica de 80 mm. */
export default function Cupom({ venda }) {
  return (
    <div className="cupom">
      <p className="c-centro"><strong>MERCADO</strong><br />CUPOM NÃO FISCAL</p>
      <p>Venda nº {venda.id}<br />{dataHora(venda.criadoEm)}<br />Operador: {venda.operador}</p>
      {venda.status === 'CANCELADA' && <p className="c-centro"><strong>*** VENDA CANCELADA ***</strong></p>}
      <hr />
      {venda.itens.map((i, n) => (
        <div key={n}>
          <div>{i.nome}</div>
          <div className="c-linha">
            <span>{numero(i.quantidade)} {i.unidade} x {moeda(i.precoUnitario)}</span>
            <span>{moeda(i.total)}</span>
          </div>
        </div>
      ))}
      <hr />
      <div className="c-linha"><span>Subtotal</span><span>{moeda(venda.subtotal)}</span></div>
      {Number(venda.desconto) > 0 && <div className="c-linha"><span>Desconto</span><span>- {moeda(venda.desconto)}</span></div>}
      <div className="c-linha c-total"><span>TOTAL</span><span>{moeda(venda.total)}</span></div>
      <hr />
      {venda.pagamentos.map((p, n) => (
        <div key={n} className="c-linha"><span>{FORMAS[p.forma]}</span><span>{moeda(p.valor)}</span></div>
      ))}
      {Number(venda.troco) > 0 && <div className="c-linha"><span>Troco</span><span>{moeda(venda.troco)}</span></div>}
      <p className="c-centro">Obrigado pela preferência!</p>
    </div>
  )
}
