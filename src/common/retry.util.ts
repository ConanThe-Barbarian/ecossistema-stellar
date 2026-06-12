/**
 * Retry com espera — essencial para o Azure SQL serverless (plano gratuito),
 * que pausa quando ocioso e demora ~30-60s para acordar na primeira conexão.
 *
 * Uso: await comRetentativas(() => this.prisma.faturas.findMany(...), 'lembretes');
 */
export async function comRetentativas<T>(
  fn: () => Promise<T>,
  contexto: string,
  tentativas = 4,
  esperaMs = 30_000,
): Promise<T> {
  let ultimoErro: unknown;

  for (let i = 1; i <= tentativas; i++) {
    try {
      return await fn();
    } catch (erro: any) {
      ultimoErro = erro;
      // P1001/P1002 = banco inacessível (provavelmente acordando)
      const ehConexao =
        erro?.code === 'P1001' ||
        erro?.code === 'P1002' ||
        /reach database|connection|ETIMEDOUT|ECONNREFUSED/i.test(erro?.message ?? '');

      if (!ehConexao || i === tentativas) throw erro;

      console.warn(
        `[Stellar Retry] ${contexto}: banco indisponível (tentativa ${i}/${tentativas}). ` +
          `Aguardando ${esperaMs / 1000}s para o Azure SQL acordar...`,
      );
      await new Promise((res) => setTimeout(res, esperaMs));
    }
  }

  throw ultimoErro;
}
