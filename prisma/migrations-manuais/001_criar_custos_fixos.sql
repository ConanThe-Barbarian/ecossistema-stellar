-- ─────────────────────────────────────────────────────────────
-- Migração manual 001: tabela custos_fixos (DRE por cliente)
-- Rodar no SQL Server (StellarSyntecDB) antes de usar /financeiro/dre
-- empresa_id NULL = custo geral da operação (rateado entre clientes ativos)
-- mes_inicio/mes_fim formato 'YYYY-MM' (NULL = vigente sempre)
-- ─────────────────────────────────────────────────────────────
IF OBJECT_ID('dbo.custos_fixos', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.custos_fixos (
    id           UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_custos_fixos_id DEFAULT newid(),
    empresa_id   UNIQUEIDENTIFIER NULL,
    descricao    NVARCHAR(255)    NOT NULL,
    valor_mensal DECIMAL(18,2)    NOT NULL,
    mes_inicio   VARCHAR(7)       NULL,
    mes_fim      VARCHAR(7)       NULL,
    status       VARCHAR(20)      NOT NULL CONSTRAINT DF_custos_fixos_status DEFAULT 'ATIVO',
    created_at   DATETIME2        NOT NULL CONSTRAINT DF_custos_fixos_created DEFAULT GETDATE(),
    updated_at   DATETIME2        NOT NULL CONSTRAINT DF_custos_fixos_updated DEFAULT GETDATE(),
    CONSTRAINT PK_custos_fixos PRIMARY KEY (id),
    CONSTRAINT FK_CustosFixos_Empresas FOREIGN KEY (empresa_id) REFERENCES dbo.empresas(id)
  );
  PRINT 'Tabela custos_fixos criada com sucesso!';
END
ELSE
  PRINT 'Tabela custos_fixos ja existe, nada a fazer.';
