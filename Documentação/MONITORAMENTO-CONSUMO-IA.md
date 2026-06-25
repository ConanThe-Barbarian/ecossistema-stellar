# Monitoramento automático de consumo de IA (tokens)

Mede o consumo de tokens dos **agentes de IA do n8n** (que atendem os clientes),
de forma automática — sem lançamento manual. Os dados aparecem no portal em
**Torre de Controle → Consumo de IA**, com recortes diário, semanal, mensal e detalhado,
quebrados por cliente e por agente.

## Como funciona

1. Cada vez que um agente de IA roda no n8n, o fluxo faz um `HTTP Request` para o
   endpoint de ingestão do Ecossistema Stellar, enviando quantos tokens foram usados.
2. O backend identifica a empresa (cliente), calcula o custo e grava um registro
   detalhado (tabela `consumo_ia`).
3. O painel "Consumo de IA" agrega tudo nos recortes (dia/semana/mês) e no detalhe.

## Configuração (.env do backend)

```
# Token compartilhado entre o n8n e o backend (defina um valor forte e secreto)
CONSUMO_IA_TOKEN=troque-por-um-token-secreto

# Preço por 1.000 tokens em R$ (opcional). 0 = só conta volume, sem custo.
# Ex.: 0,05 cobra R$ 0,05 a cada 1.000 tokens.
IA_PRECO_POR_1K_TOKENS=0
```

Depois de adicionar o modelo novo, gere o schema no banco (rodar no Windows, na raiz):

```
npx prisma db push
npx prisma generate
```

## Endpoint de ingestão (o n8n chama)

`POST /consumo-ia/ingest`

Cabeçalho obrigatório:

```
x-consumo-token: <CONSUMO_IA_TOKEN>
Content-Type: application/json
```

Corpo (identifique a empresa por UM destes: `empresa_id`, `cnpj` ou `telefone`):

```json
{
  "cnpj": "12.345.678/0001-99",
  "agente": "GalaxIA - Atendimento WhatsApp",
  "modelo": "gpt-4o-mini",
  "tokens_prompt": 820,
  "tokens_resposta": 240,
  "referencia": "conversa:5511999998888",
  "ocorrido_em": "2026-06-17T14:32:00Z"
}
```

Campos:

- `empresa_id` / `cnpj` / `telefone` — identificação do cliente (pelo menos um).
  O telefone tolera DDI/máscara (compara os dígitos finais).
- `agente` — nome do fluxo/agente no n8n (aparece no "Por agente").
- `modelo` — modelo de IA usado (opcional).
- `tokens_prompt`, `tokens_resposta` — contagem de tokens. Pode mandar
  `tokens_total` direto, se preferir.
- `custo_reais` — opcional. Se não vier, o backend calcula por `IA_PRECO_POR_1K_TOKENS`.
- `referencia` — id de conversa, telefone ou chamado (rastreabilidade).
- `ocorrido_em` — data/hora do evento (ISO 8601). Se omitido, usa o instante atual.

Resposta de sucesso:

```json
{ "registrado": true, "id": "...", "empresa": "Escola de Musica Cifras LTDA", "tokens_total": 1060 }
```

## Onde pegar os tokens no n8n

Os nós de IA do n8n (OpenAI, Vertex/Gemini, LangChain) retornam o uso de tokens
na resposta (ex.: `usage.prompt_tokens`, `usage.completion_tokens`, ou
`tokenUsage`). Mapeie esses campos no nó `HTTP Request` que chama o endpoint acima.

Exemplo de expressões no n8n (ajuste ao nó que você usa):

```
tokens_prompt   = {{ $json.usage.prompt_tokens }}
tokens_resposta = {{ $json.usage.completion_tokens }}
```

## Consulta (portal / API)

`GET /consumo-ia?granularidade=dia|semana|mes|detalhado&de=2026-06-01&ate=2026-06-17`

Restrito à equipe Stellar. Parâmetros opcionais: `empresa_id`, `agente`.
A tela "Consumo de IA" já consome esse endpoint.

## Segurança

- O endpoint de ingestão é público (sem login), mas exige o token secreto no header
  `x-consumo-token` (comparação segura, à prova de timing). Sem token válido → 401.
- A consulta exige login e só a equipe Stellar tem acesso.
- Mantenha o `CONSUMO_IA_TOKEN` fora do versionamento (o `.env` é git-ignored).
