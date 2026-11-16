CREATE TABLE usuarios (
    id        BIGSERIAL PRIMARY KEY,
    nome      VARCHAR(120) NOT NULL,
    email     VARCHAR(160) NOT NULL UNIQUE,
    senha     VARCHAR(100) NOT NULL,
    perfil    VARCHAR(20)  NOT NULL,
    ativo     BOOLEAN      NOT NULL DEFAULT TRUE,
    criado_em TIMESTAMP    NOT NULL DEFAULT now()
);
