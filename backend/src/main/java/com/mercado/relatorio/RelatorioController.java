package com.mercado.relatorio;

import com.mercado.common.Papeis;
import com.mercado.relatorio.RelatorioService.*;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/relatorios")
@RequiredArgsConstructor
@PreAuthorize(Papeis.GESTAO)
public class RelatorioController {
    private final RelatorioService service;

    @GetMapping("/vendas")
    public Vendas vendas(@RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate de,
                         @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate ate,
                         @RequestParam(defaultValue = "DIA") Agrupamento agrupamento) {
        return service.vendas(de, ate, agrupamento);
    }

    @GetMapping("/curva-abc")
    public CurvaAbc curvaAbc(@RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate de,
                             @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate ate) {
        return service.curvaAbc(de, ate);
    }

    @GetMapping("/categorias")
    public List<Grupo> categorias(@RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate de,
                                  @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate ate) {
        return service.categorias(de, ate);
    }

    @GetMapping("/operadores")
    public List<Operador> operadores(@RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate de,
                                     @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate ate) {
        return service.operadores(de, ate);
    }

    @GetMapping("/pagamentos")
    public List<Pagamento> pagamentos(@RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate de,
                                      @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate ate) {
        return service.pagamentos(de, ate);
    }

    @GetMapping("/horarios")
    public List<Horario> horarios(@RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate de,
                                  @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate ate) {
        return service.horarios(de, ate);
    }

    @GetMapping("/dre")
    public Dre dre(@RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate de,
                   @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate ate) {
        return service.dre(de, ate);
    }
}
