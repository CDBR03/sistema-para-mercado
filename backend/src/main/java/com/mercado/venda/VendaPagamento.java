package com.mercado.venda;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;

@Entity
@Table(name = "venda_pagamentos")
@Getter @Setter @NoArgsConstructor
public class VendaPagamento {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "venda_id")
    private Venda venda;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private FormaPagamento forma;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal valor;
}
