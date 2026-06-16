import { Injectable } from '@nestjs/common';
import { comRetentativas } from '../common/retry.util';
import { Cron } from '@nestjs/schedule';
import { WebhooksService } from '../webhooks/webhooks.service';
import { PrismaService } from '../prisma/prisma.service';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import * as fs from 'fs';
import * as handlebars from 'handlebars';
import * as puppeteer from 'puppeteer';


@Injectable()
export class RelatoriosService {
  constructor(private prisma: PrismaService, private readonly webhooks: WebhooksService) {}

async gerarRelatorioCompleto(mes: number, ano: number, empresaId?: string) {
  const dataInicio = new Date(ano, mes - 1, 1);
  const dataFim = new Date(ano, mes, 0, 23, 59, 59);

  // 1. Busca TODOS os técnicos ativos para garantir que apareçam no relatório
const todosTecnicos = await this.prisma.usuarios.findMany({
  where: { 
    perfis_acesso: {
      nome: { in: ['Técnico', 'Super Admin'] } 
    } 
  },
  select: { nome: true }
});

  // Inicializa o contador de todos com 0
  const resumoTecnicosMap = {};
  todosTecnicos.forEach(t => resumoTecnicosMap[t.nome] = 0);

  // 2. Busca os chamados com relacionamentos
  const chamados = await this.prisma.chamados.findMany({
    where: {
      ...(empresaId && { empresa_origem_id: empresaId }),
      status: { in: ['RESOLVIDO', 'FECHADO'] },
      updated_at: { gte: dataInicio, lte: dataFim }
    },
    include: {
      usuarios_chamados_tecnico_atribuido_idTousuarios: { select: { nome: true } },
      empresas_chamados_empresa_origem_idToempresas: { select: { razao_social: true } }
    }
  });

  const resumoPrioridades = {
    URGENTE: { total: 0, noPrazo: 0, violado: 0 },
    ALTA: { total: 0, noPrazo: 0, violado: 0 },
    MEDIA: { total: 0, noPrazo: 0, violado: 0 },
    BAIXA: { total: 0, noPrazo: 0, violado: 0 },
  };

  const detalhesChamados = chamados.map(c => {
    const noPrazo = c.data_limite_solucao && c.updated_at <= c.data_limite_solucao;
    const prioridade = (c.prioridade || 'MEDIA') as keyof typeof resumoPrioridades;
    const nomeTecnico = c.usuarios_chamados_tecnico_atribuido_idTousuarios?.nome || 'Não Atribuído';

    // Incrementa estatísticas
    resumoPrioridades[prioridade].total++;
    noPrazo ? resumoPrioridades[prioridade].noPrazo++ : resumoPrioridades[prioridade].violado++;
    
    // Incrementa chamados do técnico se ele estiver na nossa lista
    if (resumoTecnicosMap.hasOwnProperty(nomeTecnico)) {
      resumoTecnicosMap[nomeTecnico]++;
    }

    return {
      id: c.id,
      titulo: c.titulo,
      tecnico: nomeTecnico,
      empresa: c.empresas_chamados_empresa_origem_idToempresas?.razao_social,
      statusSla: noPrazo ? 'NO_PRAZO' : 'VIOLADO',
      prioridade: c.prioridade
    };
  });

  return {
    periodo: `${mes}/${ano}`,
    dataGeracao: new Date().toLocaleString('pt-BR'), // Dia/Mês/Ano e Hora
    isGestor: !empresaId, // Define se é visão de gestor (exibe IDs)
    resumoPrioridades,
    resumoTecnicos: Object.entries(resumoTecnicosMap).map(([nome, total]) => ({ nome, total })),
    detalhesChamados
  };
}

/**
 * Relatório mensal automático para os gestores:
 * todo dia 1 às 08:00 gera o PDF de gestão do mês anterior e dispara
 * o webhook do n8n (que envia no WhatsApp dos fundadores).
 */
@Cron('0 8 1 * *')
async gerarRelatorioMensalAutomatico() {
  try {
    const agora = new Date();
    const mesAnterior = new Date(agora.getFullYear(), agora.getMonth() - 1, 1);
    const mes = mesAnterior.getMonth() + 1;
    const ano = mesAnterior.getFullYear();

    console.log(`[Stellar Relatorios] Gerando relatorio mensal automatico ${mes}/${ano}...`);
    // Retry: o Azure SQL serverless pode estar pausado quando o cron dispara
    const dados = await comRetentativas(() => this.gerarRelatorioCompleto(mes, ano), 'relatorio mensal');
    const pdf = await this.exportarPdfSla(dados);

    await this.webhooks.dispararEvento('RELATORIO_MENSAL_GESTAO', {
      periodo: `${mes}/${ano}`,
      nome_arquivo: pdf.nome_arquivo,
      url_download: `/relatorios/download/${pdf.nome_arquivo}`,
    });

    console.log(`[Stellar Relatorios] Relatorio mensal ${mes}/${ano} gerado e webhook disparado.`);
  } catch (error) {
    console.error('[Stellar Relatorios] Falha no relatorio mensal automatico:', error);
  }
}

async exportarPdfSla(dados: any) {
  const outputDir = path.join(process.cwd(), 'uploads', 'relatorios');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const templatePath = path.join(process.cwd(), 'src/relatorios/templates', 'relatorio-sla.hbs');
  
  // 🛡️ NÍVEL 1 DE SEGURANÇA: Nome impossível de ser adivinhado (UUID v4)
  const nomeArquivo = `relatorio_sla_${uuidv4()}.pdf`; 
  
  const outputPath = path.join(outputDir, nomeArquivo);

  if (!handlebars.helpers.eq) {
    handlebars.registerHelper('eq', (a, b) => a === b);
  }

  const htmlTemplate = fs.readFileSync(templatePath, 'utf8');
  const templateCompilado = handlebars.compile(htmlTemplate);
  const htmlFinal = templateCompilado(dados);

  const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--no-sandbox'] 
  });
  
  const page = await browser.newPage();
  await page.setContent(htmlFinal, { waitUntil: 'networkidle0' });

  await page.pdf({
    path: outputPath,
    format: 'A4',
    printBackground: true,
    margin: { top: '20mm', right: '10mm', bottom: '20mm', left: '10mm' }
  });

  await browser.close();

  return {
    message: "PDF Gerado com sucesso e blindado via UUID!",
    nome_arquivo: nomeArquivo,
    url_acesso: `/uploads/relatorios/${nomeArquivo}`
  };
}

  // Resumo gerencial consolidando TODOS os clientes no mês (mes no formato 'YYYY-MM').
  async resumoClientes(mes: string) {
    const [ano, m] = mes.split('-').map(Number);
    const inicio = new Date(ano, m - 1, 1);
    const fim = new Date(ano, m, 1);
    const agora = new Date();

    const empresas = await this.prisma.empresas.findMany({
      where: { tipo_empresa: 'CLIENTE', deleted_at: null },
      select: { id: true, razao_social: true },
      orderBy: { razao_social: 'asc' },
    });

    const clientes: any[] = [];
    const totais = { clientes: empresas.length, faturado: 0, recebido: 0, em_aberto: 0, chamados: 0, inadimplentes: 0 };

    for (const emp of empresas) {
      const [contrato, faturas, chamados] = await Promise.all([
        this.prisma.contratos.findFirst({
          where: { empresa_id: emp.id, status: 'ATIVO' },
          include: { planos: { select: { nome: true } } },
        }),
        this.prisma.faturas.findMany({
          where: { empresa_id: emp.id, data_vencimento: { gte: inicio, lt: fim } },
          select: { valor: true, status: true, data_vencimento: true },
        }),
        this.prisma.chamados.findMany({
          where: { empresa_origem_id: emp.id, created_at: { gte: inicio, lt: fim } },
          select: { status: true },
        }),
      ]);

      let faturado = 0;
      let recebido = 0;
      let emAberto = 0;
      let vencidas = 0;
      for (const f of faturas) {
        const v = Number(f.valor);
        faturado += v;
        if (f.status === 'PAGO' || f.status === 'RECEBIDO') {
          recebido += v;
        } else {
          emAberto += v;
          if (new Date(f.data_vencimento) < agora) vencidas++;
        }
      }

      const chamadosResolvidos = chamados.filter((c) =>
        ['RESOLVIDO', 'FECHADO'].includes(c.status),
      ).length;
      const situacao = vencidas > 0 ? 'EM_DEBITO' : 'EM_DIA';

      totais.faturado += faturado;
      totais.recebido += recebido;
      totais.em_aberto += emAberto;
      totais.chamados += chamados.length;
      if (situacao === 'EM_DEBITO') totais.inadimplentes++;

      clientes.push({
        empresa_id: emp.id,
        empresa: emp.razao_social,
        plano: contrato?.planos?.nome ?? null,
        mensalidade: contrato ? Number(contrato.valor_mensalidade) : 0,
        faturado,
        recebido,
        em_aberto: emAberto,
        situacao,
        chamados_total: chamados.length,
        chamados_resolvidos: chamadosResolvidos,
      });
    }

    return { mes, totais, clientes };
  }
}