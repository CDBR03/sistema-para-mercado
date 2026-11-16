package com.mercado.categoria;

import com.mercado.categoria.CategoriaService.*;
import com.mercado.common.Papeis;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/categorias")
@RequiredArgsConstructor
public class CategoriaController {
    private final CategoriaService service;

    @GetMapping
    public List<Response> listar() { return service.listar(); }

    @PostMapping @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize(Papeis.GESTAO_ESTOQUE)
    public Response criar(@Valid @RequestBody Request r) { return service.criar(r); }

    @PutMapping("/{id}")
    @PreAuthorize(Papeis.GESTAO_ESTOQUE)
    public Response atualizar(@PathVariable Long id, @Valid @RequestBody Request r) {
        return service.atualizar(id, r);
    }

    @DeleteMapping("/{id}") @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize(Papeis.GESTAO_ESTOQUE)
    public void excluir(@PathVariable Long id) { service.excluir(id); }
}
