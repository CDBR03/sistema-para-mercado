package com.mercado.financeiro;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface ContaRepository extends JpaRepository<Conta, Long>, JpaSpecificationExecutor<Conta> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from Conta c where c.id = :id")
    Optional<Conta> buscarParaAtualizar(@Param("id") Long id);

    List<Conta> findByPedidoCompraIdOrderByVencimentoAsc(Long pedidoId);

    @Query("""
           select count(c), coalesce(sum(c.valor), 0) from Conta c
           where c.tipo = :tipo and c.status = com.mercado.financeiro.StatusConta.ABERTA
             and c.vencimento >= :de and c.vencimento <= :ate
           """)
    List<Object[]> totaisAbertas(@Param("tipo") TipoConta tipo, @Param("de") LocalDate de, @Param("ate") LocalDate ate);

    @Query("""
           select coalesce(sum(c.valorPago), 0) from Conta c
           where c.tipo = :tipo and c.status = com.mercado.financeiro.StatusConta.PAGA
             and c.pagoEm >= :de and c.pagoEm <= :ate
           """)
    BigDecimal somaPagas(@Param("tipo") TipoConta tipo, @Param("de") LocalDate de, @Param("ate") LocalDate ate);
}
