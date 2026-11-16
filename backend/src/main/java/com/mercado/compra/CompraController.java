package com.mercado.compra;

import com.mercado.common.Pagina;
import com.mercado.common.Papeis;
import com.mercado.compra.CompraService.*;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/compras")
@RequiredArgsConstructor
@PreAuthorize(Papeis.GESTAO_ESTOQUE)
public class CompraController {
    private final CompraService service;

    @GetMapping
    public Pagina<Linha> listar(@RequestParam(required = false) StatusPedido status,
                                @RequestParam(required = false) Long fornecedorId,
                                @RequestParam(defaultValue = "0") int pagina,
                                @RequestParam(defaultValue = "15") int tamanho) {
        return service.listar(status, fornecedorId, pagina, tamanho);
    }

    @GetMapping("/sugestao")
    public List<Sugestao> sugestao(@RequestParam(required = false) Long fornecedorId) { return service.sugestao(fornecedorId); }

    @GetMapping("/{id}")
    public Response buscar(@PathVariable Long id) { return service.buscar(id); }

    @PostMapping @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize(Papeis.GESTAO)
    public Response criar(@Valid @RequestBody Request r, Authentication auth) { return service.criar(r, auth.getName()); }

    @PutMapping("/{id}")
    @PreAuthorize(Papeis.GESTAO)
    public Response atualizar(@PathVariable Long id, @Valid @RequestBody Request r) { return service.atualizar(id, r); }

    /** O estoquista confere a mercadoria e dá entrada. */
    @PostMapping("/{id}/recebimento")
    public Response receber(@PathVariable Long id, @Valid @RequestBody(required = false) Recebimento r, Authentication auth) {
        return service.receber(id, r, auth.getName());
    }

    @PostMapping("/{id}/cancelamento")
    @PreAuthorize(Papeis.GESTAO)
    public Response cancelar(@PathVariable Long id, @Valid @RequestBody Cancelamento c, Authentication auth) {
        return service.cancelar(id, c.motivo(), auth.getName());
    }
}
