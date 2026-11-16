-- Etapa 5: pedidos de compra e financeiro (contas a pagar e a receber)

CREATE TABLE pedidos_compra (
    id                       BIGSERIAL PRIMARY KEY,
    fornecedor_id            BIGINT        NOT NULL REFERENCES fornecedores(id),
    status                   VARCHAR(15)   NOT NULL,
    previsao_entrega         DATE,
    observacao               VARCHAR(300),
    parcelas                 INT           NOT NULL DEFAULT 1,
    primeiro_vencimento_dias INT           NOT NULL DEFAULT 30,  -- contados a partir do recebimento
    intervalo_dias           INT           NOT NULL DEFAULT 30,
    total                    NUMERIC(12,2) NOT NULL,
    total_recebido           NUMERIC(12,2),
    numero_nota              VARCHAR(60),
    criado_por_id            BIGINT        NOT NULL REFERENCES usuarios(id),
    criado_em                TIMESTAMPTZ   NOT NULL DEFAULT now(),
    recebido_em              TIMESTAMPTZ,
    recebido_por_id          BIGINT REFERENCES usuarios(id),
    cancelado_em             TIMESTAMPTZ,
    cancelado_por_id         BIGINT REFERENCES usuarios(id),
    motivo_cancelamento      VARCHAR(200),
    CONSTRAINT ck_pedido_parcelas CHECK (parcelas BETWEEN 1 AND 24)
);
CREATE INDEX idx_pedidos_status ON pedidos_compra (status, criado_em DESC);
CREATE INDEX idx_pedidos_fornecedor ON pedidos_compra (fornecedor_id);

CREATE TABLE pedido_compra_itens (
    id                  BIGSERIAL PRIMARY KEY,
    pedido_id           BIGINT        NOT NULL REFERENCES pedidos_compra(id),
    produto_id          BIGINT        NOT NULL REFERENCES produtos(id),
    quantidade          NUMERIC(12,3) NOT NULL,
    custo_unitario      NUMERIC(12,2) NOT NULL,
    total               NUMERIC(12,2) NOT NULL,
    quantidade_recebida NUMERIC(12,3),
    custo_recebido      NUMERIC(12,2)
);
CREATE INDEX idx_pedido_itens_pedido ON pedido_compra_itens (pedido_id);

CREATE TABLE contas (
    id               BIGSERIAL PRIMARY KEY,
    tipo             VARCHAR(10)   NOT NULL,           -- PAGAR | RECEBER
    descricao        VARCHAR(160)  NOT NULL,
    categoria        VARCHAR(20)   NOT NULL,
    fornecedor_id    BIGINT REFERENCES fornecedores(id),
    pedido_compra_id BIGINT REFERENCES pedidos_compra(id),
    parcela          VARCHAR(10),
    valor            NUMERIC(12,2) NOT NULL CHECK (valor > 0),
    vencimento       DATE          NOT NULL,
    status           VARCHAR(12)   NOT NULL,           -- ABERTA | PAGA | CANCELADA
    pago_em          DATE,
    valor_pago       NUMERIC(12,2),
    forma_pagamento  VARCHAR(20),
    observacao       VARCHAR(300),
    criado_por_id    BIGINT        NOT NULL REFERENCES usuarios(id),
    criado_em        TIMESTAMPTZ   NOT NULL DEFAULT now(),
    baixado_por_id   BIGINT REFERENCES usuarios(id),
    baixado_em       TIMESTAMPTZ,
    cancelado_por_id BIGINT REFERENCES usuarios(id),
    cancelado_em     TIMESTAMPTZ,
    motivo_cancelamento VARCHAR(200)
);
CREATE INDEX idx_contas_venc   ON contas (status, vencimento);
CREATE INDEX idx_contas_pago   ON contas (pago_em) WHERE status = 'PAGA';
CREATE INDEX idx_contas_pedido ON contas (pedido_compra_id);
