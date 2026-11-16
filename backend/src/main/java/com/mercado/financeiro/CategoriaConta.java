package com.mercado.financeiro;

public enum CategoriaConta {
    /** Compra de mercadoria (gerada pelo recebimento de pedidos). Vira estoque, não despesa, na DRE. */
    FORNECEDOR,
    ALUGUEL, ENERGIA, AGUA, INTERNET, SALARIOS, IMPOSTOS, MANUTENCAO, MARKETING, TARIFAS,
    /** Receitas que não passam pelo PDV (ex.: aluguel de espaço, bonificação de fornecedor). */
    RECEITA_DIVERSA,
    OUTROS
}
