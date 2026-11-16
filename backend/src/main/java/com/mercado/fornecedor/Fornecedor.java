package com.mercado.fornecedor;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "fornecedores")
@Getter @Setter @NoArgsConstructor
public class Fornecedor {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "razao_social", nullable = false, length = 160)
    private String razaoSocial;

    @Column(unique = true, length = 14)
    private String cnpj;

    @Column(length = 20)
    private String telefone;

    @Column(length = 160)
    private String email;

    @Column(nullable = false)
    private boolean ativo = true;
}
