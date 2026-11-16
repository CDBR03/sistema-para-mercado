package com.mercado.produto;

import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface ProdutoRepository extends JpaRepository<Produto, Long> {

    @Query("""
           select p from Produto p
           where p.ativo = true
             and (lower(p.nome) like lower(concat('%', :busca, '%'))
                  or p.codigoBarras like concat('%', :busca, '%'))
           """)
    Page<Produto> buscar(@Param("busca") String busca, Pageable pageable);

    Optional<Produto> findByCodigoBarrasAndAtivoTrue(String codigoBarras);
    boolean existsByCodigoBarras(String codigoBarras);
    boolean existsByCodigoBarrasAndIdNot(String codigoBarras, Long id);
    boolean existsByCategoriaId(Long categoriaId);
    long countByAtivoTrue();

    /** Trava a linha até o fim da transação: evita dois caixas baixando o mesmo saldo ao mesmo tempo. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from Produto p where p.id = :id")
    Optional<Produto> buscarParaAtualizar(@Param("id") Long id);

    @Query("select p from Produto p where p.ativo = true and p.estoqueAtual <= p.estoqueMinimo order by p.nome")
    List<Produto> estoqueBaixo();

    @Query("""
           select p from Produto p
           where p.ativo = true and p.estoqueAtual > 0
             and p.validade is not null and p.validade <= :limite
           order by p.validade, p.nome
           """)
    List<Produto> comValidadeAte(@Param("limite") LocalDate limite);

    @Query("select coalesce(sum(p.estoqueAtual * p.precoCusto), 0) from Produto p where p.ativo = true")
    BigDecimal valorEmCusto();

    @Query("select coalesce(sum(p.estoqueAtual * p.precoVenda), 0) from Produto p where p.ativo = true")
    BigDecimal valorEmVenda();
}
