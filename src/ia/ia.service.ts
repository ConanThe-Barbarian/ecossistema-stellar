import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * IA generativa (Google Vertex AI / Gemini) para os chamados.
 *
 * Integração opcional, no mesmo padrão das demais (n8n, Chatwoot, SMTP): só
 * ativa quando `VERTEX_PROJECT` estiver no .env e houver credencial ADC
 * (`GOOGLE_APPLICATION_CREDENTIALS` apontando para o JSON do service account).
 * Sem isso, cada método devolve `{ disponivel: false, ... }` sem quebrar nada.
 *
 * Variáveis de ambiente:
 *   VERTEX_PROJECT    ID do projeto Google Cloud
 *   VERTEX_LOCATION   região (default: us-central1)
 *   VERTEX_MODEL      modelo (default: gemini-1.5-flash)
 *   GOOGLE_APPLICATION_CREDENTIALS  caminho do JSON do service account
 */
@Injectable()
export class IaService {
  private readonly logger = new Logger(IaService.name);
  // tipo solto para não acoplar o import do SDK quando a IA está desligada
  private model: any = null;

  constructor(private prisma: PrismaService) {}

  private get configurada(): boolean {
    return !!process.env.VERTEX_PROJECT;
  }

  private async getModel(): Promise<any | null> {
    if (!this.configurada) return null;
    if (this.model) return this.model;
    try {
      // import dinâmico: o SDK só é carregado quando a IA está habilitada
      const { VertexAI } = await import('@google-cloud/vertexai');
      const vertex = new VertexAI({
        project: process.env.VERTEX_PROJECT as string,
        location: process.env.VERTEX_LOCATION || 'us-central1',
      });
      this.model = vertex.getGenerativeModel({
        model: process.env.VERTEX_MODEL || 'gemini-1.5-flash',
      });
      return this.model;
    } catch (error) {
      this.logger.error('Falha ao inicializar a Vertex AI:', error as any);
      return null;
    }
  }

  /** Geração genérica. Retorna o texto ou null (não configurada / falha). */
  private async gerar(prompt: string): Promise<string | null> {
    const model = await this.getModel();
    if (!model) {
      this.logger.log('🤖 [IA/log] Vertex não configurada — geração ignorada.');
      return null;
    }
    try {
      const resp = await model.generateContent(prompt);
      const texto =
        resp?.response?.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
      return texto ? String(texto).trim() : null;
    } catch (error) {
      this.logger.error('Erro na geração da Vertex AI:', error as any);
      return null;
    }
  }

  // Monta um texto legível do chamado (título, descrição e conversa).
  private async montarContexto(chamadoId: string): Promise<string> {
    const chamado = await this.prisma.chamados.findUnique({
      where: { id: chamadoId },
      include: {
        interacoes: {
          orderBy: { created_at: 'asc' },
          include: { usuarios: { select: { nome: true } } },
        },
      },
    });
    if (!chamado) throw new NotFoundException('Chamado não encontrado.');

    const conversa = chamado.interacoes
      .map((i) => `- ${i.usuarios?.nome ?? 'Usuário'}: ${i.mensagem}`)
      .join('\n');

    return [
      `Título: ${chamado.titulo}`,
      `Categoria: ${chamado.categoria} | Prioridade: ${chamado.prioridade} | Status: ${chamado.status}`,
      `Descrição: ${chamado.descricao}`,
      conversa ? `Conversa:\n${conversa}` : 'Conversa: (sem interações ainda)',
    ].join('\n');
  }

  async resumirChamado(chamadoId: string) {
    const contexto = await this.montarContexto(chamadoId);
    const prompt =
      'Você é um assistente de suporte técnico. Resuma o chamado a seguir em até 3 frases, ' +
      'em português do Brasil, destacando o problema e o estado atual. Seja objetivo.\n\n' +
      contexto;
    const resumo = await this.gerar(prompt);
    return resumo
      ? { disponivel: true, resumo }
      : { disponivel: false, mensagem: 'IA não configurada ou indisponível.' };
  }

  async analisarSentimento(chamadoId: string) {
    const contexto = await this.montarContexto(chamadoId);
    const prompt =
      'Analise o sentimento do cliente no chamado abaixo. Responda em português do Brasil ' +
      'no formato exato "SENTIMENTO: <POSITIVO|NEUTRO|NEGATIVO> — <justificativa em 1 frase>".\n\n' +
      contexto;
    const analise = await this.gerar(prompt);
    return analise
      ? { disponivel: true, analise }
      : { disponivel: false, mensagem: 'IA não configurada ou indisponível.' };
  }

  async sugerirResposta(chamadoId: string) {
    const contexto = await this.montarContexto(chamadoId);
    const prompt =
      'Você é um técnico de suporte da Stellar Syntec. Com base no chamado abaixo, escreva uma ' +
      'resposta cordial, profissional e objetiva em português do Brasil para a última mensagem do ' +
      'cliente, propondo os próximos passos. Não invente dados que não estejam no contexto.\n\n' +
      contexto;
    const sugestao = await this.gerar(prompt);
    return sugestao
      ? { disponivel: true, sugestao }
      : { disponivel: false, mensagem: 'IA não configurada ou indisponível.' };
  }
}
