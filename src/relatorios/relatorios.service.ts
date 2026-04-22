import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import * as fs from 'fs';
import * as handlebars from 'handlebars';
import * as puppeteer from 'puppeteer';


@Injectable()
export class RelatoriosService {
  constructor(private prisma: PrismaService) {}

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
}