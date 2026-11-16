package com.mercado.venda;

import com.mercado.produto.Produto;
import com.mercado.produto.Unidade;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;

/** Guarda nome, código e preço como estavam na hora da venda: o cupom não muda se o cadastro mudar. */
@Entity
@Table(name = "venda_itens")
@Getter @Setter @NoArgsConstructor
public class VendaItem {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "venda_id")
    private Venda venda;

    @ManyToOne(optional = false)
    @JoinColumn(name = "produto_id")
    private Produto produto;

    @Column(name = "codigo_barras", nullable = false, length = 30)
    private String codigoBarras;

    @Column(nullable = false, length = 160)
    private String nome;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 5)
    private Unidade unidade;

    @Column(nullable = false, precision = 12, scale = 3)
    private BigDecimal quantidade;

    @Column(name = "preco_unitario", nullable = false, precision = 12, scale = 2)
    private BigDecimal precoUnitario;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal total;
}
