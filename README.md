# Mercado — Etapa 1: base e autenticação

Sistema de gerenciamento para mercado, desenvolvido em etapas. Nesta versão já estão disponíveis a autenticação, o cadastro de produtos e fornecedores, o controle de estoque e o PDV.

## Como executar

### Banco de dados e API

Com Docker:

```bash
docker compose up --build
```

A API fica disponível em `http://localhost:8080` e a documentação Swagger em `http://localhost:8080/swagger-ui.html`.

Sem Docker para a API:

```bash
docker compose up db
cd backend
mvn spring-boot:run
```

### Front-end

```bash
cd frontend
npm install
npm run dev
```

O front-end será iniciado em `http://localhost:5173`.

## Usuários de teste

Esses usuários são criados automaticamente:

| Perfil | E-mail | Senha |
|---|---|---|
| Admin | admin@mercado.com | admin123 |
| Gerente | gerente@mercado.com | gerente123 |
| Caixa | caixa@mercado.com | caixa123 |
| Estoquista | estoque@mercado.com | estoque123 |

Antes de usar o sistema em produção, troque o `JWT_SECRET` e as senhas padrão.

## Funcionalidades

### Catálogo

- Cadastro de categorias, fornecedores e produtos.
- Busca e paginação na listagem de produtos.
- Consulta de produto por código de barras, usada pelo PDV.
- Controle de permissões por perfil.
- Produtos e fornecedores são inativados em vez de apagados, preservando o histórico.
- O estoque atual não é alterado pelo cadastro do produto; as movimentações são feitas pelo módulo de estoque.

Principais endpoints:

- `/api/categorias`
- `/api/fornecedores`
- `/api/produtos`
- `/api/produtos/codigo/{codigo}`

### Estoque

- Registro de entradas, saídas e ajustes.
- Histórico paginado com filtros.
- Alertas de estoque baixo e produtos próximos do vencimento.
- Resumo do estoque para Admin e Gerente.
- Bloqueio de saldo negativo.
- Registro do saldo anterior, saldo posterior, motivo, usuário e data de cada movimentação.
- Produtos vendidos por unidade, caixa ou pacote não aceitam quantidades fracionadas.

A movimentação é centralizada no `EstoqueService.aplicar(...)`, que também será utilizado pelas vendas e pelas compras.

Principais endpoints:

- `POST /api/estoque/movimentacoes`
- `GET /api/estoque/movimentacoes`
- `GET /api/estoque/alertas?dias=7`
- `GET /api/estoque/resumo`

### PDV e vendas

- Registro de vendas com dinheiro, Pix, débito e crédito.
- Pagamento dividido em mais de uma forma.
- Cálculo de troco apenas para valores pagos em dinheiro.
- Descontos disponíveis somente para Gerente e Admin.
- Cancelamento de vendas com devolução automática dos itens ao estoque.
- Histórico e indicadores de vendas de acordo com o perfil do usuário.
- Cupom não fiscal para impressora térmica de 80 mm.
- Atalhos: leitor de código de barras com Enter, `3*código` para três unidades e F2 para finalizar a venda.

As vendas são processadas em uma única transação: os produtos, o estoque e o pagamento são validados antes da gravação. Se alguma etapa falhar, a venda não é registrada.

A emissão de NFC-e não faz parte do projeto atual e exigiria integração com a SEFAZ.
