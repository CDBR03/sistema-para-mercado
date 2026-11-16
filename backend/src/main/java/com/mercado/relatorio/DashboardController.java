package com.mercado.relatorio;

import com.mercado.common.Papeis;
import com.mercado.relatorio.DashboardService.*;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/dashboard")
@RequiredArgsConstructor
public class DashboardController {
    private final DashboardService service;

    @GetMapping
    @PreAuthorize(Papeis.GESTAO)
    public Gestao gestao() { return service.gestao(); }

    @GetMapping("/meu-dia")
    public MeuDia meuDia(Authentication auth) { return service.meuDia(auth.getName()); }
}
