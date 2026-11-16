package com.mercado.categoria;

import com.mercado.produto.ProdutoRepository;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
@RequiredArgsConstructor
public class CategoriaService {
    public record Request(@NotBlank(message = "é obrigatório") @Size(max = 80) String nome) {}
    public record Response(Long id, String nome) {
        static Response de(Categoria c) { return new Response(c.getId(), c.getNome()); }
    }

    private final CategoriaRepository repo;
    private final ProdutoRepository produtos;

    @Transactional(readOnly = true)
    public List<Response> listar() {
        return repo.findAllByOrderByNomeAsc().stream().map(Response::de).toList();
    }

    @Transactional
    public Response criar(Request r) {
        validarNome(r.nome(), null);
        Categoria c = new Categoria();
        c.setNome(r.nome().trim());
        return Response.de(repo.save(c));
    }

    @Transactional
    public Response atualizar(Long id, Request r) {
        Categoria c = buscar(id);
        validarNome(r.nome(), id);
        c.setNome(r.nome().trim());
        return Response.de(c);
    }

    @Transactional
    public void excluir(Long id) {
        Categoria c = buscar(id);
        if (produtos.existsByCategoriaId(id)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Esta categoria possui produtos e não pode ser excluída");
        }
        repo.delete(c);
    }

    private Categoria buscar(Long id) {
        return repo.findById(id).orElseThrow(
                () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Categoria não encontrada"));
    }

    private void validarNome(String nome, Long idAtual) {
        repo.findByNomeIgnoreCase(nome.trim()).ifPresent(outra -> {
            if (!outra.getId().equals(idAtual)) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Já existe uma categoria com esse nome");
            }
        });
    }
}
