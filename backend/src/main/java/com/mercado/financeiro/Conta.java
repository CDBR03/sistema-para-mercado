package com.mercado.financeiro;

import com.mercado.auth.Usuario;
import com.mercado.compra.PedidoCompra;
import com.mercado.fornecedor.Fornecedor;
import com.mercado.venda.FormaPagamento;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "contas")
@Getter @Setter @NoArgsConstructor
public class Conta {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private TipoConta tipo;

    @Column(nullable = false, length = 160)
    private String descricao;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private CategoriaConta categoria;

    @ManyToOne
    @JoinColumn(name = "fornecedor_id")
    private Fornecedor fornecedor;

    @ManyToOne
    @JoinColumn(name = "pedido_compra_id")
    private PedidoCompra pedidoCompra;

    @Column(length = 10)
    private String parcela;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal valor;

    @Column(nullable = false)
    private LocalDate vencimento;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 12)
    private StatusConta status = StatusConta.ABERTA;

    @Column(name = "pago_em")
    private LocalDate pagoEm;

    @Column(name = "valor_pago", precision = 12, scale = 2)
    private BigDecimal valorPago;

    @Enumerated(EnumType.STRING)
    @Column(name = "forma_pagamento", length = 20)
    private FormaPagamento formaPagamento;

    @Column(length = 300)
    private String observacao;

    @ManyToOne(optional = false)
    @JoinColumn(name = "criado_por_id")
    private Usuario criadoPor;

    @Column(name = "criado_em", nullable = false, updatable = false)
    private Instant criadoEm = Instant.now();

    @ManyToOne
    @JoinColumn(name = "baixado_por_id")
    private Usuario baixadoPor;

    @Column(name = "baixado_em")
    private Instant baixadoEm;

    @ManyToOne
    @JoinColumn(name = "cancelado_por_id")
    private Usuario canceladoPor;

    @Column(name = "cancelado_em")
    private Instant canceladoEm;

    @Column(name = "motivo_cancelamento", length = 200)
    private String motivoCancelamento;
}
