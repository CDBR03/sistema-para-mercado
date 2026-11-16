CREATE TABLE movimentacoes_estoque (
    id              BIGSERIAL PRIMARY KEY,
    produto_id      BIGINT        NOT NULL REFERENCES produtos(id),
    tipo            VARCHAR(20)   NOT NULL,
    quantidade      NUMERIC(12,3) NOT NULL,   -- variação com sinal: entradas positivas, saídas negativas
    saldo_anterior  NUMERIC(12,3) NOT NULL,
    saldo_posterior NUMERIC(12,3) NOT NULL,
    motivo          VARCHAR(200),
    usuario_id      BIGINT        NOT NULL REFERENCES usuarios(id),
    criado_em       TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX idx_mov_produto ON movimentacoes_estoque (produto_id, criado_em DESC);
CREATE INDEX idx_mov_data    ON movimentacoes_estoque (criado_em DESC);
