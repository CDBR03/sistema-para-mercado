package com.mercado.fornecedor;

import com.mercado.produto.ProdutoRepository;
import jakarta.validation.constraints.Email;
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
public class FornecedorService {
    public record Request(
            @NotBlank(message = "é obrigatória") @Size(max = 160) String razaoSocial,
            String cnpj,
            @Size(max = 20) String telefone,
            @Email(message = "inválido") @Size(max = 160) String email) {}

    public record Response(Long id, String razaoSocial, String cnpj, String telefone, String email) {
        static Response de(Fornecedor f) {
            return new Response(f.getId(), f.getRazaoSocial(), f.getCnpj(), f.getTelefone(), f.getEmail());
        }
    }

    private final FornecedorRepository repo;
    private final ProdutoRepository produtos;

    @Transactional(readOnly = true)
    public List<Response> listar(String busca) {
        return repo.findByAtivoTrueAndRazaoSocialContainingIgnoreCaseOrderByRazaoSocialAsc(busca.trim())
                .stream().map(Response::de).toList();
    }

    @Transactional
    public Response criar(Request r) {
        Fornecedor f = new Fornecedor();
        aplicar(f, r, null);
        return Response.de(repo.save(f));
    }

    @Transactional
    public Response atualizar(Long id, Request r) {
        Fornecedor f = repo.findById(id).filter(Fornecedor::isAtivo).orElseThrow(
                () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Fornecedor não encontrado"));
        aplicar(f, r, id);
        return Response.de(f);
    }

    /** Inativa o fornecedor, preservando o histórico de compras futuras. */
    @Transactional
    public void inativar(Long id) {
        Fornecedor f = repo.findById(id).orElseThrow(
                () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Fornecedor não encontrado"));
        f.setAtivo(false);
    }

    private void aplicar(Fornecedor f, Request r, Long idAtual) {
        String cnpj = r.cnpj() == null ? "" : r.cnpj().replaceAll("\\D", "");
        if (!cnpj.isEmpty()) {
            if (cnpj.length() != 14) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "CNPJ deve ter 14 dígitos");
            }
            boolean duplicado = idAtual == null ? repo.existsByCnpj(cnpj) : repo.existsByCnpjAndIdNot(cnpj, idAtual);
            if (duplicado) throw new ResponseStatusException(HttpStatus.CONFLICT, "CNPJ já cadastrado");
        }
        f.setRazaoSocial(r.razaoSocial().trim());
        f.setCnpj(cnpj.isEmpty() ? null : cnpj);
        f.setTelefone(blankToNull(r.telefone()));
        f.setEmail(blankToNull(r.email()));
    }

    private static String blankToNull(String s) { return s == null || s.isBlank() ? null : s.trim(); }
}
