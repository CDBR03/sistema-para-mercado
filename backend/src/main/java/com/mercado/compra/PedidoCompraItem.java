package com.mercado.compra;

import com.mercado.produto.Produto;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;

@Entity
@Table(name = "pedido_compra_itens")
@Getter @Setter @NoArgsConstructor
public class PedidoCompraItem {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "pedido_id")
    private PedidoCompra pedido;

    @ManyToOne(optional = false)
    @JoinColumn(name = "produto_id")
    private Produto produto;

    @Column(nullable = false, precision = 12, scale = 3)
    private BigDecimal quantidade;

    @Column(name = "custo_unitario", nullable = false, precision = 12, scale = 2)
    private BigDecimal custoUnitario;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal total;

    /** Preenchidos no recebimento: o que de fato chegou e o custo da nota. */
    @Column(name = "quantidade_recebida", precision = 12, scale = 3)
    private BigDecimal quantidadeRecebida;

    @Column(name = "custo_recebido", precision = 12, scale = 2)
    private BigDecimal custoRecebido;
}
