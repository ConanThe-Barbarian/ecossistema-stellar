/**
 * 🔑 Reset de senha — Ecossistema Stellar
 *
 * Uso (na pasta do projeto):
 *   npx ts-node scripts/resetar-senha.ts email@exemplo.com NovaSenha123
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const [email, novaSenha] = process.argv.slice(2);

  if (!email || !novaSenha) {
    console.error('Uso: npx ts-node scripts/resetar-senha.ts <email> <nova_senha>');
    process.exit(1);
  }
  if (novaSenha.length < 8) {
    console.error('❌ A senha deve ter no mínimo 8 caracteres.');
    process.exit(1);
  }

  const usuario = await prisma.usuarios.findUnique({ where: { email } });
  if (!usuario) {
    console.error(`❌ Usuário ${email} não encontrado.`);
    process.exit(1);
  }

  const hash = await bcrypt.hash(novaSenha, 10);
  await prisma.usuarios.update({
    where: { email },
    data: { senha_hash: hash, updated_at: new Date() },
  });

  console.log(`✅ Senha de ${usuario.nome} (${email}) redefinida com sucesso!`);
}

main()
  .catch((e) => {
    console.error('❌ Erro:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
