package com.mercado.produto;

import com.mercado.categoria.CategoriaRepository;
import com.mercado.common.Pagina;
import com.mercado.fornecedor.FornecedorRepository;
import jakarta.validation.constraints.*;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;

@Service
@RequiredArgsConstructor
public class ProdutoService {

    public record Request(
            @NotBlank(message = "é obrigatório") @Size(max = 30) String codigoBarras,
            @NotBlank(message = "é obrigatório") @Size(max = 160) String nome,
            @NotNull(message = "é obrigatória") Long categoriaId,
            Long fornecedorId,
            @NotNull(message = "é obrigatória") Unidade unidade,
            @NotNull(message = "é obrigatório") @PositiveOrZero(message = "não pode ser negativo") BigDecimal precoCusto,
            @NotNull(message = "é obrigatório") @Positive(message = "deve ser maior que zero") BigDecimal precoVenda,
            @NotNull(message = "é obrigatório") @PositiveOrZero(message = "não pode ser negativo") BigDecimal estoqueMinimo,
            LocalDate validade) {}

    public record Response(Long id, String codigoBarras, String nome,
                           Long categoriaId, String categoriaNome,
                           Long fornecedorId, String fornecedorNome,
                           Unidade unidade, BigDecimal precoCusto, BigDecimal precoVenda,
                           BigDecimal estoqueAtual, BigDecimal estoqueMinimo, LocalDate validade) {
        static Response de(Produto p) {
            var f = p.getFornecedor();
            return new Response(p.getId(), p.getCodigoBarras(), p.getNome(),
                    p.getCategoria().getId(), p.getCategoria().getNome(),
                    f == null ? null : f.getId(), f == null ? null : f.getRazaoSocial(),
                    p.getUnidade(), p.getPrecoCusto(), p.getPrecoVenda(),
                    p.getEstoqueAtual(), p.getEstoqueMinimo(), p.getValidade());
        }
    }

    private final ProdutoRepository repo;
    private final CategoriaRepository categorias;
    private final FornecedorRepository fornecedores;

    @Transactional(readOnly = true)
    public Pagina<Response> listar(String busca, int pagina, int tamanho) {
        var pageable = PageRequest.of(Math.max(pagina, 0), Math.min(Math.max(tamanho, 1), 100), Sort.by("nome"));
        return Pagina.de(repo.buscar(busca.trim(), pageable), Response::de);
    }

    @Transactional(readOnly = true)
    public Response buscarPorId(Long id) { return Response.de(carregar(id)); }

    /** Usado pelo PDV na leitura do código de barras (Etapa 4). */
    @Transactional(readOnly = true)
    public Response buscarPorCodigo(String codigo) {
        return repo.findByCodigoBarrasAndAtivoTrue(codigo).map(Response::de).orElseThrow(
                () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Produto não encontrado"));
    }

    @Transactional
    public Response criar(Request r) {
        if (repo.existsByCodigoBarras(r.codigoBarras().trim())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Já existe um produto com esse código de barras");
        }
        Produto p = new Produto();
        aplicar(p, r);
        return Response.de(repo.save(p));
    }

    @Transactional
    public Response atualizar(Long id, Request r) {
        Produto p = carregar(id);
        if (repo.existsByCodigoBarrasAndIdNot(r.codigoBarras().trim(), id)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Já existe um produto com esse código de barras");
        }
        aplicar(p, r);
        return Response.de(p);
    }

    /** Produtos nunca são apagados: o histórico de vendas depende deles. */
    @Transactional
    public void inativar(Long id) { carregar(id).setAtivo(false); }

    private Produto carregar(Long id) {
        return repo.findById(id).filter(Produto::isAtivo).orElseThrow(
                () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Produto não encontrado"));
    }

    private void aplicar(Produto p, Request r) {
        p.setCodigoBarras(r.codigoBarras().trim());
        p.setNome(r.nome().trim());
        p.setCategoria(categorias.findById(r.categoriaId()).orElseThrow(
                () -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Categoria não encontrada")));
        p.setFornecedor(r.fornecedorId() == null ? null : fornecedores.findById(r.fornecedorId()).orElseThrow(
                () -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Fornecedor não encontrado")));
        p.setUnidade(r.unidade());
        p.setPrecoCusto(r.precoCusto());
        p.setPrecoVenda(r.precoVenda());
        p.setEstoqueMinimo(r.estoqueMinimo());
        p.setValidade(r.validade());
    }
}
