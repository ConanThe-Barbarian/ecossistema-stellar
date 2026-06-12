IF OBJECT_ID ('dbo.anexos') IS NOT NULL
	DROP TABLE dbo.anexos
GO

CREATE TABLE dbo.anexos
	(
	id           UNIQUEIDENTIFIER DEFAULT (newid()) NOT NULL,
	chamado_id   UNIQUEIDENTIFIER NULL,
	interacao_id UNIQUEIDENTIFIER NULL,
	nome_arquivo NVARCHAR (255) NOT NULL,
	url_arquivo  NVARCHAR (max) NOT NULL,
	tipo_arquivo VARCHAR (50) NULL,
	created_at   DATETIME2 DEFAULT (getdate()) NOT NULL,
	PRIMARY KEY (id),
	CONSTRAINT FK_Anexos_Chamados FOREIGN KEY (chamado_id) REFERENCES dbo.chamados (id),
	CONSTRAINT FK_Anexos_Interacoes FOREIGN KEY (interacao_id) REFERENCES dbo.interacoes (id)
	)
GO

IF OBJECT_ID ('dbo.chamados') IS NOT NULL
	DROP TABLE dbo.chamados
GO

CREATE TABLE dbo.chamados
	(
	id                     UNIQUEIDENTIFIER DEFAULT (newid()) NOT NULL,
	empresa_origem_id      UNIQUEIDENTIFIER NOT NULL,
	requerente_id          UNIQUEIDENTIFIER NOT NULL,
	empresa_responsavel_id UNIQUEIDENTIFIER NOT NULL,
	tecnico_atribuido_id   UNIQUEIDENTIFIER NULL,
	titulo                 NVARCHAR (200) NOT NULL,
	descricao              NVARCHAR (max) NOT NULL,
	categoria              VARCHAR (50) NOT NULL,
	prioridade             VARCHAR (20) NOT NULL CHECK ([prioridade]='URGENTE' OR [prioridade]='ALTA' OR [prioridade]='MEDIA' OR [prioridade]='BAIXA'),
	status                 VARCHAR (30) CONSTRAINT DF_chamados_status DEFAULT ('NOVO') NOT NULL CHECK ([status]='FECHADO' OR [status]='RESOLVIDO' OR [status]='PENDENTE_CLIENTE' OR [status]='EM_ATENDIMENTO' OR [status]='NOVO'),
	data_limite_resposta   DATETIME2 NULL,
	data_limite_solucao    DATETIME2 NULL,
	tempo_gasto_minutos    INT DEFAULT ((0)) NOT NULL,
	created_at             DATETIME2 DEFAULT (getdate()) NOT NULL,
	updated_at             DATETIME2 DEFAULT (getdate()) NOT NULL,
	PRIMARY KEY (id),
	CONSTRAINT FK_Chamados_EmpresaOrigem FOREIGN KEY (empresa_origem_id) REFERENCES dbo.empresas (id),
	CONSTRAINT FK_Chamados_EmpresaResponsavel FOREIGN KEY (empresa_responsavel_id) REFERENCES dbo.empresas (id),
	CONSTRAINT FK_Chamados_Requerente FOREIGN KEY (requerente_id) REFERENCES dbo.usuarios (id),
	CONSTRAINT FK_Chamados_Tecnico FOREIGN KEY (tecnico_atribuido_id) REFERENCES dbo.usuarios (id)
	)
GO

IF OBJECT_ID ('dbo.config_slas') IS NOT NULL
	DROP TABLE dbo.config_slas
GO

CREATE TABLE dbo.config_slas
	(
	id                   UNIQUEIDENTIFIER DEFAULT (newid()) NOT NULL,
	plano_id             UNIQUEIDENTIFIER NOT NULL,
	prioridade           VARCHAR (20) NOT NULL CHECK ([prioridade]='URGENTE' OR [prioridade]='ALTA' OR [prioridade]='MEDIA' OR [prioridade]='BAIXA'),
	tempo_resposta_horas INT NOT NULL,
	tempo_solucao_horas  INT NOT NULL,
	created_at           DATETIME2 DEFAULT (getdate()) NOT NULL,
	PRIMARY KEY (id),
	CONSTRAINT FK_ConfigSlas_Planos FOREIGN KEY (plano_id) REFERENCES dbo.planos (id)
	)
GO

IF OBJECT_ID ('dbo.consumo_variavel') IS NOT NULL
	DROP TABLE dbo.consumo_variavel
GO

CREATE TABLE dbo.consumo_variavel
	(
	id                 UNIQUEIDENTIFIER DEFAULT (newid()) NOT NULL,
	empresa_id         UNIQUEIDENTIFIER NOT NULL,
	mes_referencia     VARCHAR (7) NOT NULL,
	qtd_tokens         INT DEFAULT ((0)) NOT NULL,
	custo_gerado_reais DECIMAL (18, 2) DEFAULT ((0.00)) NOT NULL,
	created_at         DATETIME2 DEFAULT (getdate()) NOT NULL,
	PRIMARY KEY (id),
	CONSTRAINT FK_Consumo_Empresas FOREIGN KEY (empresa_id) REFERENCES dbo.empresas (id)
	)
GO

IF OBJECT_ID ('dbo.contratos') IS NOT NULL
	DROP TABLE dbo.contratos
GO

CREATE TABLE dbo.contratos
	(
	id                UNIQUEIDENTIFIER DEFAULT (newid()) NOT NULL,
	empresa_id        UNIQUEIDENTIFIER NOT NULL,
	plano_id          UNIQUEIDENTIFIER NOT NULL,
	valor_mensalidade DECIMAL (18, 2) NOT NULL,
	dia_vencimento    INT NOT NULL CHECK ([dia_vencimento]>=(1) AND [dia_vencimento]<=(31)),
	status            VARCHAR (20) DEFAULT ('ATIVO') NOT NULL CHECK ([status]='CANCELADO' OR [status]='SUSPENSO' OR [status]='ATIVO'),
	created_at        DATETIME2 DEFAULT (getdate()) NOT NULL,
	updated_at        DATETIME2 DEFAULT (getdate()) NOT NULL,
	PRIMARY KEY (id),
	CONSTRAINT FK_Contratos_Empresas FOREIGN KEY (empresa_id) REFERENCES dbo.empresas (id),
	CONSTRAINT FK_Contratos_Planos FOREIGN KEY (plano_id) REFERENCES dbo.planos (id)
	)
GO

IF OBJECT_ID ('dbo.empresas') IS NOT NULL
	DROP TABLE dbo.empresas
GO

CREATE TABLE dbo.empresas
	(
	id                  UNIQUEIDENTIFIER DEFAULT (newid()) NOT NULL,
	razao_social        NVARCHAR (255) NOT NULL,
	nome_fantasia       NVARCHAR (255) NULL,
	cnpj_cpf            VARCHAR (20) NOT NULL,
	inscricao_estadual  VARCHAR (50) NULL,
	tipo_empresa        VARCHAR (30) NOT NULL CHECK ([tipo_empresa]='PARCEIRO' OR [tipo_empresa]='CLIENTE' OR [tipo_empresa]='STELLAR_SYNTEC'),
	status              VARCHAR (20) DEFAULT ('ATIVO') NOT NULL CHECK ([status]='CANCELADO' OR [status]='SUSPENSO' OR [status]='INADIMPLENTE' OR [status]='ATIVO'),
	email_financeiro    VARCHAR (255) NULL,
	telefone_principal  VARCHAR (20) NULL,
	endereco_cep        VARCHAR (10) NULL,
	endereco_logradouro NVARCHAR (255) NULL,
	endereco_numero     VARCHAR (20) NULL,
	endereco_cidade     NVARCHAR (100) NULL,
	endereco_estado     CHAR (2) NULL,
	ui_customizacao     NVARCHAR (max) NULL CONSTRAINT CHK_ui_customizacao_IsJson CHECK ([ui_customizacao] IS NULL OR isjson([ui_customizacao])=(1)),
	created_at          DATETIME2 DEFAULT (getdate()) NOT NULL,
	updated_at          DATETIME2 DEFAULT (getdate()) NOT NULL,
	deleted_at          DATETIME2 NULL,
	PRIMARY KEY (id),
	UNIQUE (cnpj_cpf)
	)
GO

IF OBJECT_ID ('dbo.faturas') IS NOT NULL
	DROP TABLE dbo.faturas
GO

CREATE TABLE dbo.faturas
	(
	id               UNIQUEIDENTIFIER DEFAULT (newid()) NOT NULL,
	empresa_id       UNIQUEIDENTIFIER NOT NULL,
	contrato_id      UNIQUEIDENTIFIER NULL,
	asaas_payment_id VARCHAR (100) NULL,
	valor            DECIMAL (18, 2) NOT NULL,
	data_vencimento  DATE NOT NULL,
	data_pagamento   DATETIME2 NULL,
	status           VARCHAR (20) DEFAULT ('PENDENTE') NOT NULL CHECK ([status]='CANCELADO' OR [status]='ATRASADO' OR [status]='PAGO' OR [status]='PENDENTE'),
	url_fatura       NVARCHAR (max) NULL,
	linha_digitavel  VARCHAR (100) NULL,
	created_at       DATETIME2 DEFAULT (getdate()) NOT NULL,
	updated_at       DATETIME2 DEFAULT (getdate()) NOT NULL,
	PRIMARY KEY (id),
	UNIQUE (asaas_payment_id),
	CONSTRAINT FK_Faturas_Empresas FOREIGN KEY (empresa_id) REFERENCES dbo.empresas (id),
	CONSTRAINT FK_Faturas_Contratos FOREIGN KEY (contrato_id) REFERENCES dbo.contratos (id)
	)
GO

IF OBJECT_ID ('dbo.ferramentas_contratadas') IS NOT NULL
	DROP TABLE dbo.ferramentas_contratadas
GO

CREATE TABLE dbo.ferramentas_contratadas
	(
	contrato_id       UNIQUEIDENTIFIER NOT NULL,
	servico_id        UNIQUEIDENTIFIER NOT NULL,
	token_sso_cliente NVARCHAR (max) NULL,
	url_acesso        NVARCHAR (max) NULL,
	status_acesso     VARCHAR (20) DEFAULT ('LIBERADO') NOT NULL CHECK ([status_acesso]='BLOQUEADO' OR [status_acesso]='LIBERADO'),
	PRIMARY KEY (contrato_id, servico_id),
	CONSTRAINT FK_Ferramentas_Contratos FOREIGN KEY (contrato_id) REFERENCES dbo.contratos (id),
	CONSTRAINT FK_Ferramentas_Servicos FOREIGN KEY (servico_id) REFERENCES dbo.servicos (id)
	)
GO

IF OBJECT_ID ('dbo.interacoes') IS NOT NULL
	DROP TABLE dbo.interacoes
GO

CREATE TABLE dbo.interacoes
	(
	id              UNIQUEIDENTIFIER DEFAULT (newid()) NOT NULL,
	chamado_id      UNIQUEIDENTIFIER NOT NULL,
	usuario_id      UNIQUEIDENTIFIER NOT NULL,
	mensagem        NVARCHAR (max) NOT NULL,
	is_nota_interna BIT DEFAULT ((0)) NOT NULL,
	created_at      DATETIME2 DEFAULT (getdate()) NOT NULL,
	PRIMARY KEY (id),
	CONSTRAINT FK_Interacoes_Chamados FOREIGN KEY (chamado_id) REFERENCES dbo.chamados (id),
	CONSTRAINT FK_Interacoes_Usuarios FOREIGN KEY (usuario_id) REFERENCES dbo.usuarios (id)
	)
GO

IF OBJECT_ID ('dbo.perfis_acesso') IS NOT NULL
	DROP TABLE dbo.perfis_acesso
GO

CREATE TABLE dbo.perfis_acesso
	(
	id                       UNIQUEIDENTIFIER DEFAULT (newid()) NOT NULL,
	nome                     NVARCHAR (100) NOT NULL,
	descricao                NVARCHAR (255) NULL,
	can_open_internal_ticket BIT DEFAULT ((1)) NOT NULL,
	can_open_stellar_ticket  BIT DEFAULT ((0)) NOT NULL,
	can_manage_users         BIT DEFAULT ((0)) NOT NULL,
	created_at               DATETIME2 DEFAULT (getdate()) NOT NULL,
	updated_at               DATETIME2 DEFAULT (getdate()) NOT NULL,
	deleted_at               DATETIME2 NULL,
	can_generate_invoices    BIT DEFAULT ((0)) NOT NULL,
	PRIMARY KEY (id)
	)
GO

IF OBJECT_ID ('dbo.planos') IS NOT NULL
	DROP TABLE dbo.planos
GO

CREATE TABLE dbo.planos
	(
	id         UNIQUEIDENTIFIER DEFAULT (newid()) NOT NULL,
	nome       NVARCHAR (100) NOT NULL,
	tipo_preco VARCHAR (20) NOT NULL CHECK ([tipo_preco]='SOB_MEDIDA' OR [tipo_preco]='FIXO'),
	valor_base DECIMAL (18, 2) DEFAULT ((0.00)) NOT NULL,
	created_at DATETIME2 DEFAULT (getdate()) NOT NULL,
	updated_at DATETIME2 DEFAULT (getdate()) NOT NULL,
	PRIMARY KEY (id)
	)
GO

IF OBJECT_ID ('dbo.servicos') IS NOT NULL
	DROP TABLE dbo.servicos
GO

CREATE TABLE dbo.servicos
	(
	id         UNIQUEIDENTIFIER DEFAULT (newid()) NOT NULL,
	nome       NVARCHAR (100) NOT NULL,
	descricao  NVARCHAR (255) NULL,
	icone_url  NVARCHAR (max) NULL,
	status     VARCHAR (20) DEFAULT ('ATIVO') NOT NULL CHECK ([status]='DESCONTINUADO' OR [status]='MANUTENCAO' OR [status]='ATIVO'),
	created_at DATETIME2 DEFAULT (getdate()) NOT NULL,
	updated_at DATETIME2 DEFAULT (getdate()) NOT NULL,
	PRIMARY KEY (id)
	)
GO

IF OBJECT_ID ('dbo.usuarios') IS NOT NULL
	DROP TABLE dbo.usuarios
GO

CREATE TABLE dbo.usuarios
	(
	id                UNIQUEIDENTIFIER DEFAULT (newid()) NOT NULL,
	empresa_id        UNIQUEIDENTIFIER NOT NULL,
	perfil_id         UNIQUEIDENTIFIER NOT NULL,
	nome              NVARCHAR (255) NOT NULL,
	email             VARCHAR (255) NOT NULL,
	senha_hash        VARCHAR (255) NOT NULL,
	telefone_whatsapp VARCHAR (20) NULL,
	mfa_enabled       BIT DEFAULT ((0)) NOT NULL,
	status            VARCHAR (20) DEFAULT ('ATIVO') NOT NULL CHECK ([status]='BLOQUEADO' OR [status]='INATIVO' OR [status]='ATIVO'),
	created_at        DATETIME2 DEFAULT (getdate()) NOT NULL,
	updated_at        DATETIME2 DEFAULT (getdate()) NOT NULL,
	deleted_at        DATETIME2 NULL,
	PRIMARY KEY (id),
	UNIQUE (email),
	CONSTRAINT FK_Usuarios_Empresas FOREIGN KEY (empresa_id) REFERENCES dbo.empresas (id),
	CONSTRAINT FK_Usuarios_Perfis FOREIGN KEY (perfil_id) REFERENCES dbo.perfis_acesso (id)
	)
GO

IF OBJECT_ID ('dbo.webhook_logs_asaas') IS NOT NULL
	DROP TABLE dbo.webhook_logs_asaas
GO

CREATE TABLE dbo.webhook_logs_asaas
	(
	id                   UNIQUEIDENTIFIER DEFAULT (newid()) NOT NULL,
	evento_asaas         VARCHAR (50) NOT NULL,
	asaas_payment_id     VARCHAR (100) NOT NULL,
	payload_completo     NVARCHAR (max) NOT NULL CONSTRAINT CHK_payload_IsJson CHECK (isjson([payload_completo])=(1)),
	status_processamento VARCHAR (20) DEFAULT ('PENDENTE') NOT NULL CHECK ([status_processamento]='ERRO' OR [status_processamento]='PROCESSADO' OR [status_processamento]='PENDENTE'),
	erro_detalhe         NVARCHAR (max) NULL,
	created_at           DATETIME2 DEFAULT (getdate()) NOT NULL,
	PRIMARY KEY (id)
	)
GO

