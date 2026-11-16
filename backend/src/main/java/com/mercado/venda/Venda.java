package com.mercado.venda;

import com.mercado.auth.Usuario;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "vendas")
@Getter @Setter @NoArgsConstructor
public class Venda {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "usuario_id")
    private Usuario usuario;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 15)
    private StatusVenda status = StatusVenda.CONCLUIDA;

    @Column(nullable = false, precision = 12, scale = 2) private BigDecimal subtotal;
    @Column(nullable = false, precision = 12, scale = 2) private BigDecimal desconto;
    @Column(nullable = false, precision = 12, scale = 2) private BigDecimal total;
    @Column(name = "valor_pago", nullable = false, precision = 12, scale = 2) private BigDecimal valorPago;
    @Column(nullable = false, precision = 12, scale = 2) private BigDecimal troco;

    @Column(name = "criado_em", nullable = false, updatable = false)
    private Instant criadoEm = Instant.now();

    @Column(name = "cancelada_em")
    private Instant canceladaEm;

    @ManyToOne
    @JoinColumn(name = "cancelada_por_id")
    private Usuario canceladaPor;

    @Column(name = "motivo_cancelamento", length = 200)
    private String motivoCancelamento;

    @OneToMany(mappedBy = "venda", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("id")
    private List<VendaItem> itens = new ArrayList<>();

    @OneToMany(mappedBy = "venda", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("id")
    private List<VendaPagamento> pagamentos = new ArrayList<>();
}
