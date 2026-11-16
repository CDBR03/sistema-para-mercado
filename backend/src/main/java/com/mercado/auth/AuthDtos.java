package com.mercado.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public class AuthDtos {
    public record LoginRequest(@NotBlank @Email String email, @NotBlank String senha) {}
    public record UsuarioResponse(Long id, String nome, String email, Perfil perfil) {
        public static UsuarioResponse de(Usuario u) {
            return new UsuarioResponse(u.getId(), u.getNome(), u.getEmail(), u.getPerfil());
        }
    }
    public record LoginResponse(String token, UsuarioResponse usuario) {}
}
