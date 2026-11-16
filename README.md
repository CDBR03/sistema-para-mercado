# Mercado — sistema de gestão (React + Spring Boot)

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

## Etapa 5 — Compras e financeiro
- Migração `V5__compras_financeiro.sql`: `pedidos_compra`, `pedido_compra_itens` e `contas` (a pagar e a receber).
- **Pedidos de compra** (`/api/compras`): Gerente/Admin criam, editam e cancelam pedidos em aberto; o Estoquista consulta e dá o recebimento.
  - `GET /sugestao?fornecedorId=` sugere os produtos no estoque mínimo ou abaixo, com quantidade para voltar ao dobro do mínimo.
  - `POST /{id}/recebimento` confere o que chegou (quantidade e custo por item, número da nota). Numa única transação: dá entrada no estoque (movimentação `COMPRA`), recalcula o **custo médio ponderado** de cada produto e gera as parcelas no contas a pagar pelo valor efetivamente recebido.
  - Condição de pagamento por pedido: nº de parcelas, dias até o 1º vencimento (contados do recebimento) e intervalo entre parcelas. A última parcela absorve o arredondamento.
- **Financeiro** (`/api/financeiro`, só Admin/Gerente):
  - Contas a pagar e a receber com categoria, fornecedor, vencimento e lançamento recorrente ("repetir por N meses").
  - Baixa com data, valor pago (juros/desconto) e forma; baixa pode ser desfeita. Cancelamento exige motivo. "Vencida" é calculado: conta em aberto com vencimento passado.
  - Parcelas geradas por compra não mudam de valor nem de categoria.
  - `GET /resumo` (vencidas, vencendo hoje e em 7 dias, pago/recebido no mês) e `GET /fluxo-caixa?de=&ate=`: entradas (vendas concluídas + contas recebidas) e saídas (contas pagas) dia a dia, com saldo acumulado.
- Correção: acesso negado pelo perfil agora responde **403** (antes virava 401 e o front-end deslogava o usuário).

## Etapa 6 — Painel e relatórios
- Migração `V6__relatorios.sql`: `venda_itens.custo_unitario` guarda o custo do produto no momento da venda (vendas antigas recebem o custo atual do cadastro). É a base do CMV, da margem e da curva ABC.
- **Painel** (`GET /api/dashboard`, Admin/Gerente): faturamento, vendas e ticket de hoje comparados a ontem e ao mesmo dia da semana passada; mês contra o mesmo período do mês anterior; lucro e margem bruta; gráfico de 30 dias; vendas por hora; mais vendidos; formas de pagamento; pendências (contas vencidas, estoque baixo, vencimentos, pedidos aguardando). Caixa e estoquista veem um resumo próprio (`GET /api/dashboard/meu-dia`).
- **Relatórios** (`/api/relatorios/*?de=&ate=`, Admin/Gerente), todos com exportação CSV (abre no Excel) e impressão:
  - `vendas` (agrupado por dia, semana ou mês, com CMV, lucro bruto e canceladas), `curva-abc` (classes A/B/C por faturamento), `categorias`, `operadores`, `pagamentos` (troco descontado do dinheiro), `horarios` (mapa de calor dia × hora) e `dre` (DRE gerencial simplificada).
  - Na DRE, despesas entram pela data do pagamento e compras de mercadoria não contam como despesa (o custo entra no CMV quando o produto é vendido).
  - Período máximo: 2 anos nos relatórios e 1 ano no fluxo de caixa.
- Gráficos feitos em HTML/CSS, sem biblioteca nova: passe o mouse ou use Tab para ver os valores de cada barra.
- As abas aceitam link direto: `/financeiro#fluxo`, `/relatorios#abc`, `/relatorios#dre` etc.

### Atualizar uma instalação existente
`docker compose up --build -d` recompila a API; o Flyway aplica V5 e V6 sozinho na primeira subida. As migrações só criam tabelas e uma coluna e não apagam dados.

