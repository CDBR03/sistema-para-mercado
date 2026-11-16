CREATE TABLE vendas (
    id                  BIGSERIAL PRIMARY KEY,
    usuario_id          BIGINT        NOT NULL REFERENCES usuarios(id),
    status              VARCHAR(15)   NOT NULL,
    subtotal            NUMERIC(12,2) NOT NULL,
    desconto            NUMERIC(12,2) NOT NULL DEFAULT 0,
    total               NUMERIC(12,2) NOT NULL,
    valor_pago          NUMERIC(12,2) NOT NULL,
    troco               NUMERIC(12,2) NOT NULL DEFAULT 0,
    criado_em           TIMESTAMPTZ   NOT NULL DEFAULT now(),
    cancelada_em        TIMESTAMPTZ,
    cancelada_por_id    BIGINT REFERENCES usuarios(id),
    motivo_cancelamento VARCHAR(200)
);
CREATE INDEX idx_vendas_data ON vendas (criado_em DESC);

CREATE TABLE venda_itens (
    id             BIGSERIAL PRIMARY KEY,
    venda_id       BIGINT        NOT NULL REFERENCES vendas(id),
    produto_id     BIGINT        NOT NULL REFERENCES produtos(id),
    codigo_barras  VARCHAR(30)   NOT NULL,
    nome           VARCHAR(160)  NOT NULL,
    unidade        VARCHAR(5)    NOT NULL,
    quantidade     NUMERIC(12,3) NOT NULL,
    preco_unitario NUMERIC(12,2) NOT NULL,
    total          NUMERIC(12,2) NOT NULL
);
CREATE INDEX idx_venda_itens_venda   ON venda_itens (venda_id);
CREATE INDEX idx_venda_itens_produto ON venda_itens (produto_id);

CREATE TABLE venda_pagamentos (
    id       BIGSERIAL PRIMARY KEY,
    venda_id BIGINT        NOT NULL REFERENCES vendas(id),
    forma    VARCHAR(20)   NOT NULL,
    valor    NUMERIC(12,2) NOT NULL
);
CREATE INDEX idx_venda_pag_venda ON venda_pagamentos (venda_id);
