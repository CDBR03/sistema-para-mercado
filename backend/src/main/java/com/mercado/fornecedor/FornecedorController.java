package com.mercado.fornecedor;

import com.mercado.common.Papeis;
import com.mercado.fornecedor.FornecedorService.*;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/fornecedores")
@RequiredArgsConstructor
public class FornecedorController {
    private final FornecedorService service;

    @GetMapping
    public List<Response> listar(@RequestParam(defaultValue = "") String busca) { return service.listar(busca); }

    @PostMapping @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize(Papeis.GESTAO)
    public Response criar(@Valid @RequestBody Request r) { return service.criar(r); }

    @PutMapping("/{id}")
    @PreAuthorize(Papeis.GESTAO)
    public Response atualizar(@PathVariable Long id, @Valid @RequestBody Request r) {
        return service.atualizar(id, r);
    }

    @DeleteMapping("/{id}") @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize(Papeis.GESTAO)
    public void inativar(@PathVariable Long id) { service.inativar(id); }
}
