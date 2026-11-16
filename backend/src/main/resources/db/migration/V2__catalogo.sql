CREATE TABLE categorias (
    id   BIGSERIAL PRIMARY KEY,
    nome VARCHAR(80) NOT NULL UNIQUE
);

CREATE TABLE fornecedores (
    id           BIGSERIAL PRIMARY KEY,
    razao_social VARCHAR(160) NOT NULL,
    cnpj         VARCHAR(14) UNIQUE,
    telefone     VARCHAR(20),
    email        VARCHAR(160),
    ativo        BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE produtos (
    id             BIGSERIAL PRIMARY KEY,
    codigo_barras  VARCHAR(30)  NOT NULL UNIQUE,
    nome           VARCHAR(160) NOT NULL,
    categoria_id   BIGINT       NOT NULL REFERENCES categorias(id),
    fornecedor_id  BIGINT       REFERENCES fornecedores(id),
    unidade        VARCHAR(5)   NOT NULL,
    preco_custo    NUMERIC(12,2) NOT NULL,
    preco_venda    NUMERIC(12,2) NOT NULL,
    estoque_atual  NUMERIC(12,3) NOT NULL DEFAULT 0,
    estoque_minimo NUMERIC(12,3) NOT NULL DEFAULT 0,
    validade       DATE,
    ativo          BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE INDEX idx_produtos_nome ON produtos (lower(nome));

INSERT INTO categorias (nome) VALUES
 ('Mercearia'), ('Bebidas'), ('Hortifruti'), ('Açougue'),
 ('Laticínios'), ('Padaria'), ('Limpeza'), ('Higiene');
