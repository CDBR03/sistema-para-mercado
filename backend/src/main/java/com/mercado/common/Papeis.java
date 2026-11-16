package com.mercado.common;

/** Expressões de autorização reutilizadas nos controllers. */
public final class Papeis {
    private Papeis() {}
    public static final String GESTAO = "hasAnyRole('ADMIN','GERENTE')";
    public static final String OPERACAO = "hasAnyRole('ADMIN','GERENTE','CAIXA')";
    public static final String GESTAO_ESTOQUE = "hasAnyRole('ADMIN','GERENTE','ESTOQUISTA')";
}
