# Migração de banco — Ecossistema Stellar

Guia para mover o banco do servidor atual (que será desativado) para um novo
(ex: Azure SQL Database gratuito).

## Passo 1 — Exportar os dados (URGENTE, enquanto há acesso)

Na sua máquina, com o `.env` ainda apontando para o servidor atual:

```bash
npx ts-node scripts/exportar-banco.ts
```

Isso cria a pasta `backup-banco/` com um JSON por tabela.
**Copie essa pasta para um local seguro** (Drive, pendrive). Ela não vai para o git.

## Passo 2 — Criar o banco novo (Azure SQL gratuito)

1. Crie conta em https://azure.microsoft.com/free
2. Crie um recurso "SQL Database" e marque a opção de **oferta gratuita**
   (100k vCore-segundos + 32 GB/mês, sem expiração)
3. Em Networking, libere seu IP (Add client IP) 
4. Copie o nome do servidor (ex: `meuservidor.database.windows.net`)

## Passo 3 — Apontar o sistema para o banco novo

No `.env`, troque o `DATABASE_URL`:

```
DATABASE_URL="sqlserver://meuservidor.database.windows.net:1433;database=StellarSyntecDB;user=MEU_USUARIO;password=MINHA_SENHA;encrypt=true"
```

## Passo 4 — Recriar a estrutura e importar

```bash
npx prisma db push        # cria todas as tabelas (inclusive custos_fixos)
npx prisma generate       # atualiza o client
npx ts-node scripts/importar-banco.ts
```

## Plano B — só com o SqlDbx (se o script não rodar)

A estrutura você recria com `npx prisma db push` (Passo 4), então só precisa
dos dados. No SqlDbx, para cada tabela:

1. `SELECT * FROM dbo.NOME_DA_TABELA`
2. No grid de resultados: botão direito → Export/Save As → formato
   **SQL Insert Statements**
3. Salve um `.sql` por tabela

Na importação, execute os `.sql` no banco novo NA ORDEM abaixo (pais antes
dos filhos, por causa das chaves estrangeiras):

```
perfis_acesso → empresas → usuarios → planos → config_slas → servicos →
contratos → ferramentas_contratadas → consumo_variavel → faturas →
chamados → interacoes → anexos → webhook_logs_asaas
```

Tabelas para exportar (não esqueça nenhuma):
perfis_acesso, empresas, usuarios, planos, config_slas, servicos, contratos,
ferramentas_contratadas, consumo_variavel, faturas, chamados, interacoes,
anexos, webhook_logs_asaas
