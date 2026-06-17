/**
 * Seed de clientes de teste — Ecossistema Stellar
 *
 * Seguro: NÃO apaga a empresa Stellar nem os fundadores.
 *  1) Corrige CNPJ/CPF inválidos dos clientes existentes (que quebram no Asaas).
 *  2) Garante um cliente de teste completo: empresa + plano + contrato + usuário
 *     (login) + ferramenta GalaxIA + uma fatura PENDENTE para testar pagamento.
 *
 * Uso (na pasta do projeto):
 *   npx ts-node scripts/seed-clientes-teste.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// ----- validação/geração de CNPJ e CPF -----
function calcDV(base: string): string {
  const calc = (nums: string, pesos: number[]) => {
    const soma = nums.split('').reduce((acc, n, i) => acc + Number(n) * pesos[i], 0);
    const r = soma % 11;
    return r < 2 ? '0' : String(11 - r);
  };
  const dv1 = calc(base, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const dv2 = calc(base + dv1, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return base + dv1 + dv2;
}
function gerarCnpj(base12?: string): string {
  let base = base12;
  if (!base) {
    base = '';
    for (let i = 0; i < 12; i++) base += Math.floor(Math.random() * 10);
  }
  return calcDV(base);
}
function cnpjValido(d: string): boolean {
  return d.length === 14 && !/^(\d)\1+$/.test(d) && calcDV(d.slice(0, 12)) === d;
}
function cpfValido(d: string): boolean {
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  const calc = (n: number) => {
    let s = 0;
    for (let i = 0; i < n; i++) s += Number(d[i]) * (n + 1 - i);
    const r = (s * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === Number(d[9]) && calc(10) === Number(d[10]);
}
function docValido(doc: string): boolean {
  const d = (doc || '').replace(/\D/g, '');
  return cnpjValido(d) || cpfValido(d);
}

async function main() {
  console.log('--- Seed de clientes de teste ---');

  // 1) Corrige CNPJ/CPF inválidos dos clientes (preserva Stellar)
  const clientes = await prisma.empresas.findMany({
    where: { tipo_empresa: 'CLIENTE', deleted_at: null },
    select: { id: true, razao_social: true, cnpj_cpf: true },
  });
  let corrigidos = 0;
  for (const c of clientes) {
    if (!docValido(c.cnpj_cpf)) {
      const novo = gerarCnpj();
      await prisma.empresas.update({ where: { id: c.id }, data: { cnpj_cpf: novo } });
      console.log(`  corrigido: ${c.razao_social} -> CNPJ ${novo}`);
      corrigidos++;
    }
  }
  console.log(`  ${corrigidos} cliente(s) com documento corrigido.`);

  // 2) Perfil de administrador do cliente (pode abrir chamado interno e para a Stellar)
  let perfil = await prisma.perfis_acesso.findFirst({ where: { nome: 'Administrador Cliente' } });
  if (!perfil) {
    perfil = await prisma.perfis_acesso.create({
      data: {
        nome: 'Administrador Cliente',
        descricao: 'Admin da empresa cliente',
        can_open_internal_ticket: true,
        can_open_stellar_ticket: true,
        can_manage_users: true,
        can_generate_invoices: false,
      },
    });
  }

  // Plano
  let plano = await prisma.planos.findFirst({ where: { nome: 'Plano Teste Scale' } });
  if (!plano) {
    plano = await prisma.planos.create({
      data: { nome: 'Plano Teste Scale', tipo_preco: 'FIXO', valor_base: 1500 },
    });
  }

  // Serviço (ferramenta) GalaxIA
  let servico = await prisma.servicos.findFirst({ where: { nome: 'GalaxIA' } });
  if (!servico) {
    servico = await prisma.servicos.create({
      data: { nome: 'GalaxIA', descricao: 'Plataforma Omnichannel', status: 'ATIVO' },
    });
  }

  // 3) Empresa de teste (CNPJ válido e estável)
  const cnpjDemo = gerarCnpj('112223330001');
  const empresa = await prisma.empresas.upsert({
    where: { cnpj_cpf: cnpjDemo },
    update: { razao_social: 'Cliente Teste Stellar LTDA' },
    create: {
      razao_social: 'Cliente Teste Stellar LTDA',
      nome_fantasia: 'Cliente Teste',
      cnpj_cpf: cnpjDemo,
      tipo_empresa: 'CLIENTE',
      status: 'ATIVO',
      email_financeiro: 'financeiro@clienteteste.com',
      telefone_principal: '11999990000',
    },
  });

  // Contrato ativo
  let contrato = await prisma.contratos.findFirst({ where: { empresa_id: empresa.id, status: 'ATIVO' } });
  if (!contrato) {
    contrato = await prisma.contratos.create({
      data: {
        empresa_id: empresa.id,
        plano_id: plano.id,
        valor_mensalidade: 1500,
        dia_vencimento: 10,
        status: 'ATIVO',
      },
    });
  }

  // Ferramenta contratada (GalaxIA liberada)
  const temFerramenta = await prisma.ferramentas_contratadas.findFirst({
    where: { contrato_id: contrato.id, servico_id: servico.id },
  });
  if (!temFerramenta) {
    await prisma.ferramentas_contratadas.create({
      data: {
        contrato_id: contrato.id,
        servico_id: servico.id,
        status_acesso: 'LIBERADO',
        url_acesso: 'https://galaxia.stellarsyntec.com.br',
      },
    });
  }

  // Usuário administrador (login)
  const emailLogin = 'admin@clienteteste.com';
  const senha = 'Teste@1234';
  const hash = await bcrypt.hash(senha, 10);
  await prisma.usuarios.upsert({
    where: { email: emailLogin },
    update: { senha_hash: hash, empresa_id: empresa.id, perfil_id: perfil.id, status: 'ATIVO' },
    create: {
      nome: 'Admin Cliente Teste',
      email: emailLogin,
      senha_hash: hash,
      empresa_id: empresa.id,
      perfil_id: perfil.id,
      status: 'ATIVO',
      telefone_whatsapp: '11999990000',
    },
  });

  // Fatura PENDENTE vencida (para testar o "Gerar pagamento")
  const temFatura = await prisma.faturas.findFirst({
    where: { empresa_id: empresa.id, status: 'PENDENTE' },
  });
  if (!temFatura) {
    const venc = new Date();
    venc.setDate(venc.getDate() - 5); // vencida há 5 dias
    await prisma.faturas.create({
      data: {
        empresa_id: empresa.id,
        contrato_id: contrato.id,
        valor: 1500,
        data_vencimento: venc,
        status: 'PENDENTE',
      },
    });
  }

  console.log('\n=== Cliente de teste pronto ===');
  console.log(`  Empresa: ${empresa.razao_social} (CNPJ ${cnpjDemo})`);
  console.log(`  Login:   ${emailLogin}`);
  console.log(`  Senha:   ${senha}`);
  console.log('  Tem: contrato ativo, ferramenta GalaxIA e 1 fatura PENDENTE (vencida) para testar pagamento.');
}

main()
  .catch((e) => {
    console.error('Erro no seed:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
