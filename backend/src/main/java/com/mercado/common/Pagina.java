package com.mercado.common;

import org.springframework.data.domain.Page;

import java.util.List;
import java.util.function.Function;

public record Pagina<T>(List<T> itens, int pagina, int totalPaginas, long total) {
    public static <E, T> Pagina<T> de(Page<E> page, Function<E, T> mapper) {
        return new Pagina<>(page.getContent().stream().map(mapper).toList(),
                page.getNumber(), page.getTotalPages(), page.getTotalElements());
    }
}
