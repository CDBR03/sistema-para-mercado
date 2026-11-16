package com.mercado.produto;

import com.mercado.categoria.Categoria;
import com.mercado.fornecedor.Fornecedor;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(name = "produtos")
@Getter @Setter @NoArgsConstructor
public class Produto {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "codigo_barras", nullable = false, unique = true, length = 30)
    private String codigoBarras;

    @Column(nullable = false, length = 160)
    private String nome;

    @ManyToOne(optional = false)
    @JoinColumn(name = "categoria_id")
    private Categoria categoria;

    @ManyToOne
    @JoinColumn(name = "fornecedor_id")
    private Fornecedor fornecedor;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 5)
    private Unidade unidade;

    @Column(name = "preco_custo", nullable = false, precision = 12, scale = 2)
    private BigDecimal precoCusto;

    @Column(name = "preco_venda", nullable = false, precision = 12, scale = 2)
    private BigDecimal precoVenda;

    /** Só muda por movimentação de estoque (Etapa 3) e vendas (Etapa 4). */
    @Column(name = "estoque_atual", nullable = false, precision = 12, scale = 3)
    private BigDecimal estoqueAtual = BigDecimal.ZERO;

    @Column(name = "estoque_minimo", nullable = false, precision = 12, scale = 3)
    private BigDecimal estoqueMinimo = BigDecimal.ZERO;

    private LocalDate validade;

    @Column(nullable = false)
    private boolean ativo = true;
}
