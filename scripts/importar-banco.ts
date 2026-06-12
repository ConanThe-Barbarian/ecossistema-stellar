/**
 * 🚀 Importador de banco — Ecossistema Stellar
 *
 * Lê os arquivos JSON de backup-banco/ e insere tudo no banco apontado pelo
 * DATABASE_URL do .env (o banco NOVO — Azure SQL, etc.), respeitando a ordem
 * das chaves estrangeiras.
 *
 * Passos:
 *   1. Aponte o DATABASE_URL do .env para o banco novo
 *   2. Crie a estrutura:  npx prisma db push
 *   3. Importe os dados:  npx ts-node scripts/importar-banco.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// Campos de data por tabela (JSON traz string ISO; Prisma aceita, mas
// garantimos a conversão para evitar problemas de tipo)
const CAMPOS_DATA = [
  'created_at',
  'updated_at',
  'deleted_at',
  'data_pagamento',
  'data_vencimento',
  'data_limite_resposta',
  'data_limite_solucao',
];

// Ordem IMPORTA: pais antes dos filhos (FKs)
const ORDEM_IMPORTACAO = [
  'perfis_acesso',
  'empresas',
  'usuarios',
  'planos',
  'config_slas',
  'servicos',
  'contratos',
  'ferramentas_contratadas',
  'consumo_variavel',
  'faturas',
  'chamados',
  'interacoes',
  'anexos',
  'webhook_logs_asaas',
  'custos_fixos',
];

function converterDatas(linha: Record<string, any>) {
  for (const campo of CAMPOS_DATA) {
    if (typeof linha[campo] === 'string') {
      linha[campo] = new Date(linha[campo]);
    }
  }
  return linha;
}

async function main() {
  const pastaBackup = path.join(__dirname, '..', 'backup-banco');
  if (!fs.existsSync(pastaBackup)) {
    throw new Error(
      'Pasta backup-banco/ não encontrada. Rode primeiro: npx ts-node scripts/exportar-banco.ts',
    );
  }

  let totalLinhas = 0;

  for (const tabela of ORDEM_IMPORTACAO) {
    const arquivo = path.join(pastaBackup, `${tabela}.json`);
    if (!fs.existsSync(arquivo)) {
      console.warn(`⚠️  ${tabela}: arquivo não encontrado, pulando`);
      continue;
    }

    const linhas: any[] = JSON.parse(fs.readFileSync(arquivo, 'utf8'));
    if (linhas.length === 0) {
      console.log(`➖ ${tabela}: vazia`);
      continue;
    }

    const model = (prisma as any)[tabela];
    if (!model) {
      console.warn(`⚠️  ${tabela}: model não existe no client (rode npx prisma generate)`);
      continue;
    }

    // Insere em lotes de 100 para não estourar o limite de parâmetros do SQL Server
    let inseridas = 0;
    for (let i = 0; i < linhas.length; i += 100) {
      const lote = linhas.slice(i, i + 100).map(converterDatas);
      await model.createMany({ data: lote });
      inseridas += lote.length;
    }

    console.log(`✅ ${tabela}: ${inseridas} linha(s) importada(s)`);
    totalLinhas += inseridas;
  }

  console.log(`\n🌟 Importação concluída: ${totalLinhas} linhas no banco novo!`);
}

main()
  .catch((e) => {
    console.error('❌ Falha na importação:', e);
    console.error('Dica: se for erro de FK, verifique se o banco novo está vazio e rode novamente.');
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
