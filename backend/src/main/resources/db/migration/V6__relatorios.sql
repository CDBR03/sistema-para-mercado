-- Etapa 6: guarda o custo do produto no momento da venda (base do CMV, margem e curva ABC).
ALTER TABLE venda_itens ADD COLUMN custo_unitario NUMERIC(12,2);
UPDATE venda_itens vi SET custo_unitario = p.preco_custo FROM produtos p WHERE p.id = vi.produto_id;
ALTER TABLE venda_itens ALTER COLUMN custo_unitario SET NOT NULL;

CREATE INDEX idx_vendas_status_data ON vendas (status, criado_em);
