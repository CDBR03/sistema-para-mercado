package com.mercado.estoque;

import com.mercado.common.Pagina;
import com.mercado.common.Papeis;
import com.mercado.estoque.EstoqueService.*;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/estoque")
@RequiredArgsConstructor
@PreAuthorize(Papeis.GESTAO_ESTOQUE)
public class EstoqueController {
    private final EstoqueService service;

    @PostMapping("/movimentacoes") @ResponseStatus(HttpStatus.CREATED)
    public Response movimentar(@Valid @RequestBody Request r, Authentication auth) {
        return service.registrar(r, auth.getName());
    }

    @GetMapping("/movimentacoes")
    public Pagina<Response> historico(@RequestParam(required = false) Long produtoId,
                                      @RequestParam(required = false) TipoMovimentacao tipo,
                                      @RequestParam(defaultValue = "0") int pagina,
                                      @RequestParam(defaultValue = "15") int tamanho) {
        return service.historico(produtoId, tipo, pagina, tamanho);
    }

    @GetMapping("/alertas")
    public Alertas alertas(@RequestParam(defaultValue = "7") int dias) { return service.alertas(dias); }

    @GetMapping("/resumo")
    @PreAuthorize(Papeis.GESTAO)
    public Resumo resumo() { return service.resumo(); }
}
