package com.mercado.auth;

import com.mercado.auth.AuthDtos.*;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {
    private final AuthenticationManager authManager;
    private final UsuarioRepository repo;
    private final JwtService jwt;

    @PostMapping("/login")
    public LoginResponse login(@Valid @RequestBody LoginRequest req) {
        try {
            authManager.authenticate(new UsernamePasswordAuthenticationToken(req.email(), req.senha()));
        } catch (org.springframework.security.core.AuthenticationException e) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "E-mail ou senha inválidos");
        }
        Usuario u = repo.findByEmailIgnoreCase(req.email()).orElseThrow();
        return new LoginResponse(jwt.gerar(u), UsuarioResponse.de(u));
    }

    @GetMapping("/me")
    public UsuarioResponse me(Authentication auth) {
        return UsuarioResponse.de(repo.findByEmailIgnoreCase(auth.getName()).orElseThrow());
    }
}
