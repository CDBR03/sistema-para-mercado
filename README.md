# Mercado — Etapa 1 (base + autenticação)

## Como rodar
1. Banco + API: `docker compose up --build`  (API em http://localhost:8080, Swagger em /swagger-ui.html)
   - Sem Docker para a API: `docker compose up db` e depois `cd backend && mvn spring-boot:run`
2. Front-end: `cd frontend && npm install && npm run dev`  (http://localhost:5173)

## Usuários de teste (criados automaticamente)
| Perfil | E-mail | Senha |
|---|---|---|
| Admin | admin@mercado.com | admin123 |
| Gerente | gerente@mercado.com | gerente123 |
| Caixa | caixa@mercado.com | caixa123 |
| Estoquista | estoque@mercado.com | estoque123 |

Troque o `JWT_SECRET` e as senhas antes de qualquer uso real.

## Etapa 2 — Catálogo
- Novas tabelas (migração `V2__catalogo.sql`): categorias (com 8 de exemplo), fornecedores e produtos.
- API: `/api/categorias`, `/api/fornecedores`, `/api/produtos` (busca e paginação), `/api/produtos/codigo/{codigo}` (usado no PDV).
- Permissões de escrita: produtos e categorias → Admin, Gerente, Estoquista; fornecedores → Admin, Gerente. Todos os perfis logados podem consultar.
- Produtos e fornecedores são inativados (não apagados) para preservar histórico.
- O estoque atual do produto não é editável pelo cadastro; ele passa a ser movimentado na Etapa 3.

## Etapa 3 — Estoque
- Migração `V3__estoque.sql`: tabela `movimentacoes_estoque` (cada linha guarda variação, saldo antes/depois, motivo, usuário e data).
- API `/api/estoque`: `POST /movimentacoes` (entrada, saída, ajuste), `GET /movimentacoes` (histórico paginado com filtros), `GET /alertas?dias=7` e `GET /resumo` (Admin/Gerente).
- O saldo só muda por `EstoqueService.aplicar(...)`, que trava a linha do produto, impede saldo negativo e grava o histórico. As vendas (Etapa 4) e compras (Etapa 5) reutilizam esse mesmo método.
- Saída e ajuste exigem motivo. Produtos em UN, CX e PCT não aceitam quantidade fracionada.
- Permissões: Admin, Gerente e Estoquista movimentam e consultam; o valor total em estoque (custo e venda) aparece só para Admin e Gerente.

## Etapa 4 — PDV e vendas
- Migração `V4__vendas.sql`: `vendas`, `venda_itens` (guarda nome, código e preço do momento da venda) e `venda_pagamentos`.
- `POST /api/vendas` é transacional: trava os produtos, valida estoque e pagamento, grava a venda e baixa o estoque. Se qualquer passo falhar, nada é gravado. O preço sempre vem do cadastro, nunca do navegador.
- Pagamento em várias formas (dinheiro, Pix, débito, crédito). Troco só sobre o valor pago em dinheiro.
- Desconto só por Gerente/Admin; o Caixa recebe erro 403 se tentar.
- Cancelamento (Gerente/Admin) devolve os itens ao estoque com movimentação `ESTORNO` e guarda motivo e responsável.
- Caixa vê apenas as próprias vendas; Gerente/Admin veem todas, com faturamento e ticket médio do período.
- Cupom não fiscal para impressora térmica de 80 mm (botão Imprimir). Emissão de NFC-e exigiria integração com a SEFAZ e não está incluída.
- Atalhos do PDV: leitor de código + Enter, `3*código` para várias unidades, F2 para finalizar.
