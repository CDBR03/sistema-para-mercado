package com.mercado.venda;

import com.mercado.common.Pagina;
import com.mercado.common.Papeis;
import com.mercado.venda.VendaService.*;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;

@RestController
@RequestMapping("/api/vendas")
@RequiredArgsConstructor
public class VendaController {
    private final VendaService service;

    @PostMapping @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize(Papeis.OPERACAO)
    public Response registrar(@Valid @RequestBody Request r, Authentication auth) {
        return service.registrar(r, auth.getName());
    }

    @GetMapping
    @PreAuthorize(Papeis.OPERACAO)
    public Pagina<Linha> listar(@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate de,
                                @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate ate,
                                @RequestParam(required = false) StatusVenda status,
                                @RequestParam(defaultValue = "0") int pagina,
                                @RequestParam(defaultValue = "15") int tamanho,
                                Authentication auth) {
        return service.listar(de, ate, status, pagina, tamanho, auth.getName());
    }

    @GetMapping("/periodo")
    @PreAuthorize(Papeis.GESTAO)
    public Periodo periodo(@RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate de,
                           @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate ate) {
        return service.periodo(de, ate);
    }

    @GetMapping("/{id}")
    @PreAuthorize(Papeis.OPERACAO)
    public Response buscar(@PathVariable Long id, Authentication auth) { return service.buscar(id, auth.getName()); }

    @PostMapping("/{id}/cancelamento")
    @PreAuthorize(Papeis.GESTAO)
    public Response cancelar(@PathVariable Long id, @Valid @RequestBody CancelamentoRequest r, Authentication auth) {
        return service.cancelar(id, r.motivo(), auth.getName());
    }
}
