package com.mercado.financeiro;

import com.mercado.common.Pagina;
import com.mercado.common.Papeis;
import com.mercado.financeiro.FinanceiroService.*;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/financeiro")
@RequiredArgsConstructor
@PreAuthorize(Papeis.GESTAO)
public class FinanceiroController {
    private final FinanceiroService service;

    @GetMapping("/contas")
    public Pagina<Response> listar(@RequestParam(required = false) TipoConta tipo,
                                   @RequestParam(required = false) StatusConta status,
                                   @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate de,
                                   @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate ate,
                                   @RequestParam(required = false) String busca,
                                   @RequestParam(defaultValue = "0") int pagina,
                                   @RequestParam(defaultValue = "20") int tamanho) {
        return service.listar(tipo, status, de, ate, busca, pagina, tamanho);
    }

    @PostMapping("/contas") @ResponseStatus(HttpStatus.CREATED)
    public List<Response> criar(@Valid @RequestBody Request r, Authentication auth) {
        return service.criar(r, auth.getName());
    }

    @GetMapping("/contas/{id}")
    public Response buscar(@PathVariable Long id) { return service.buscar(id); }

    @PutMapping("/contas/{id}")
    public Response atualizar(@PathVariable Long id, @Valid @RequestBody Atualizacao r) { return service.atualizar(id, r); }

    @PostMapping("/contas/{id}/baixa")
    public Response baixar(@PathVariable Long id, @Valid @RequestBody Baixa b, Authentication auth) {
        return service.baixar(id, b, auth.getName());
    }

    @DeleteMapping("/contas/{id}/baixa")
    public Response estornarBaixa(@PathVariable Long id) { return service.estornarBaixa(id); }

    @PostMapping("/contas/{id}/cancelamento")
    public Response cancelar(@PathVariable Long id, @Valid @RequestBody Cancelamento c, Authentication auth) {
        return service.cancelar(id, c.motivo(), auth.getName());
    }

    @GetMapping("/resumo")
    public Resumo resumo() { return service.resumo(); }

    @GetMapping("/fluxo-caixa")
    public Fluxo fluxo(@RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate de,
                       @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate ate) {
        return service.fluxo(de, ate);
    }
}
