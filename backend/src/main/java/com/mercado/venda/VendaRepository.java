package com.mercado.venda;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Optional;

public interface VendaRepository extends JpaRepository<Venda, Long>, JpaSpecificationExecutor<Venda> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select v from Venda v where v.id = :id")
    Optional<Venda> buscarParaAtualizar(@Param("id") Long id);

    @Query("select count(v) from Venda v where v.status = com.mercado.venda.StatusVenda.CONCLUIDA and v.criadoEm >= :ini and v.criadoEm < :fim")
    long contarConcluidas(@Param("ini") Instant ini, @Param("fim") Instant fim);

    @Query("select coalesce(sum(v.total), 0) from Venda v where v.status = com.mercado.venda.StatusVenda.CONCLUIDA and v.criadoEm >= :ini and v.criadoEm < :fim")
    BigDecimal somarConcluidas(@Param("ini") Instant ini, @Param("fim") Instant fim);
}
