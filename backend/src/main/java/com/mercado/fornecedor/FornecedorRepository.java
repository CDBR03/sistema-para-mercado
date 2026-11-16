package com.mercado.fornecedor;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface FornecedorRepository extends JpaRepository<Fornecedor, Long> {
    List<Fornecedor> findByAtivoTrueAndRazaoSocialContainingIgnoreCaseOrderByRazaoSocialAsc(String busca);
    boolean existsByCnpj(String cnpj);
    boolean existsByCnpjAndIdNot(String cnpj, Long id);
}
