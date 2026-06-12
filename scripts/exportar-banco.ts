/**
 * 🚀 Exportador de banco — Ecossistema Stellar
 *
 * Despeja todas as tabelas do banco atual (DATABASE_URL do .env) em arquivos
 * JSON dentro de backup-banco/. Rode na SUA máquina (que enxerga a VPN):
 *
 *   npx ts-node scripts/exportar-banco.ts
 *
 * Depois guarde a pasta backup-banco/ em local seguro (ela fica fora do git).
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// Ordem não importa na exportação; custos_fixos pode ainda não existir (ok)
const TABELAS = [
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

async function main() {
  const pastaDestino = path.join(__dirname, '..', 'backup-banco');
  fs.mkdirSync(pastaDestino, { recursive: true });

  let totalLinhas = 0;

  for (const tabela of TABELAS) {
    try {
      const linhas: any[] = await prisma.$queryRawUnsafe(
        `SELECT * FROM dbo.[${tabela}]`,
      );
      const arquivo = path.join(pastaDestino, `${tabela}.json`);
      fs.writeFileSync(arquivo, JSON.stringify(linhas, null, 2), 'utf8');
      console.log(`✅ ${tabela}: ${linhas.length} linha(s) exportada(s)`);
      totalLinhas += linhas.length;
    } catch (erro: any) {
      console.warn(`⚠️  ${tabela}: pulada (${erro.message?.split('\n')[0]})`);
    }
  }

  console.log(`\n🌟 Exportação concluída: ${totalLinhas} linhas em ${pastaDestino}`);
  console.log('Guarde a pasta backup-banco/ em local seguro (Drive, pendrive...)!');
}

main()
  .catch((e) => {
    console.error('❌ Falha na exportação:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
