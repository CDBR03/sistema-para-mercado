package com.mercado.estoque;

public enum TipoMovimentacao {
    ENTRADA, SAIDA, AJUSTE,
    /** Gerados por outros módulos (Etapas 4 e 5), nunca pela tela de estoque. */
    VENDA, COMPRA, ESTORNO
}
