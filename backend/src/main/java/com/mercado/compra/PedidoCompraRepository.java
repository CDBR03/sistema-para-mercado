package com.mercado.compra;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface PedidoCompraRepository extends JpaRepository<PedidoCompra, Long>, JpaSpecificationExecutor<PedidoCompra> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from PedidoCompra p where p.id = :id")
    Optional<PedidoCompra> buscarParaAtualizar(@Param("id") Long id);

    long countByStatus(StatusPedido status);
}
