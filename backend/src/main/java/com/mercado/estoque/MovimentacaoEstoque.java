package com.mercado.estoque;

import com.mercado.auth.Usuario;
import com.mercado.produto.Produto;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "movimentacoes_estoque")
@Getter @Setter @NoArgsConstructor
public class MovimentacaoEstoque {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "produto_id")
    private Produto produto;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private TipoMovimentacao tipo;

    /** Variação com sinal (entrada > 0, saída < 0). */
    @Column(nullable = false, precision = 12, scale = 3)
    private BigDecimal quantidade;

    @Column(name = "saldo_anterior", nullable = false, precision = 12, scale = 3)
    private BigDecimal saldoAnterior;

    @Column(name = "saldo_posterior", nullable = false, precision = 12, scale = 3)
    private BigDecimal saldoPosterior;

    @Column(length = 200)
    private String motivo;

    @ManyToOne(optional = false)
    @JoinColumn(name = "usuario_id")
    private Usuario usuario;

    @Column(name = "criado_em", nullable = false, updatable = false)
    private Instant criadoEm = Instant.now();
}
