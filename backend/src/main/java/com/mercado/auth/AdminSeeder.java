package com.mercado.auth;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

/** Cria usuários iniciais para desenvolvimento. Troque as senhas em produção. */
@Component
@RequiredArgsConstructor
public class AdminSeeder implements CommandLineRunner {
    private final UsuarioRepository repo;
    private final PasswordEncoder encoder;

    @Override
    public void run(String... args) {
        criar("Administrador", "admin@mercado.com", "admin123", Perfil.ADMIN);
        criar("Gerente", "gerente@mercado.com", "gerente123", Perfil.GERENTE);
        criar("Caixa 01", "caixa@mercado.com", "caixa123", Perfil.CAIXA);
        criar("Estoquista", "estoque@mercado.com", "estoque123", Perfil.ESTOQUISTA);
    }

    private void criar(String nome, String email, String senha, Perfil perfil) {
        if (repo.findByEmailIgnoreCase(email).isPresent()) return;
        Usuario u = new Usuario();
        u.setNome(nome);
        u.setEmail(email);
        u.setSenha(encoder.encode(senha));
        u.setPerfil(perfil);
        repo.save(u);
    }
}
