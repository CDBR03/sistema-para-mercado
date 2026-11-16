package com.mercado.compra;

import com.mercado.auth.Usuario;
import com.mercado.fornecedor.Fornecedor;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "pedidos_compra")
@Getter @Setter @NoArgsConstructor
public class PedidoCompra {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "fornecedor_id")
    private Fornecedor fornecedor;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 15)
    private StatusPedido status = StatusPedido.ABERTO;

    @Column(name = "previsao_entrega")
    private LocalDate previsaoEntrega;

    @Column(length = 300)
    private String observacao;

    @Column(nullable = false)
    private int parcelas = 1;

    @Column(name = "primeiro_vencimento_dias", nullable = false)
    private int primeiroVencimentoDias = 30;

    @Column(name = "intervalo_dias", nullable = false)
    private int intervaloDias = 30;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal total;

    @Column(name = "total_recebido", precision = 12, scale = 2)
    private BigDecimal totalRecebido;

    @Column(name = "numero_nota", length = 60)
    private String numeroNota;

    @ManyToOne(optional = false)
    @JoinColumn(name = "criado_por_id")
    private Usuario criadoPor;

    @Column(name = "criado_em", nullable = false, updatable = false)
    private Instant criadoEm = Instant.now();

    @Column(name = "recebido_em")
    private Instant recebidoEm;

    @ManyToOne
    @JoinColumn(name = "recebido_por_id")
    private Usuario recebidoPor;

    @Column(name = "cancelado_em")
    private Instant canceladoEm;

    @ManyToOne
    @JoinColumn(name = "cancelado_por_id")
    private Usuario canceladoPor;

    @Column(name = "motivo_cancelamento", length = 200)
    private String motivoCancelamento;

    @OneToMany(mappedBy = "pedido", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("id")
    private List<PedidoCompraItem> itens = new ArrayList<>();
}
