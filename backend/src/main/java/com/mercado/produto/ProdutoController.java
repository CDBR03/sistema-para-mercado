package com.mercado.produto;

import com.mercado.common.Pagina;
import com.mercado.common.Papeis;
import com.mercado.produto.ProdutoService.*;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/produtos")
@RequiredArgsConstructor
public class ProdutoController {
    private final ProdutoService service;

    @GetMapping
    public Pagina<Response> listar(@RequestParam(defaultValue = "") String busca,
                                   @RequestParam(defaultValue = "0") int pagina,
                                   @RequestParam(defaultValue = "10") int tamanho) {
        return service.listar(busca, pagina, tamanho);
    }

    @GetMapping("/{id}")
    public Response buscar(@PathVariable Long id) { return service.buscarPorId(id); }

    @GetMapping("/codigo/{codigo}")
    public Response buscarPorCodigo(@PathVariable String codigo) { return service.buscarPorCodigo(codigo); }

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
    public void inativar(@PathVariable Long id) { service.inativar(id); }
}
