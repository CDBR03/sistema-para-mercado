package com.mercado.produto;

public enum Unidade {
    UN, KG, L, CX, PCT;

    /** Só quilo e litro aceitam quantidade com casas decimais. */
    public boolean fracionavel() { return this == KG || this == L; }
}
