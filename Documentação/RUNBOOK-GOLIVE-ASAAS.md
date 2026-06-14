# Runbook — Go-live do Asaas (sandbox → produção)

> Objetivo: migrar a cobrança do ambiente **sandbox** para **produção** com o
> mínimo de risco. Tempo estimado: 30–45 min. Faça em horário de baixo movimento.

## Pré-requisitos

- Conta Asaas de **produção** aprovada (KYC concluído, conta liberada para cobrar).
- Acesso ao painel do Asaas de produção (https://www.asaas.com).
- Acesso ao `.env` do servidor da API e permissão para reiniciar o serviço.
- URL **pública** e HTTPS da API (o webhook do Asaas precisa alcançá-la). Ex.:
  `https://api.stellarsyntec.com.br`. Sandbox local (`localhost`) não serve.

## Variáveis envolvidas (`.env`)

| Variável | Sandbox (atual) | Produção (novo) |
|---|---|---|
| `ASAAS_API_URL` | `https://api-sandbox.asaas.com/v3` | `https://api.asaas.com/v3` |
| `ASAAS_API_KEY` | chave `$aact_hmlg_...` | chave de produção `$aact_prod_...` |
| `ASAAS_WEBHOOK_TOKEN` | token atual | **gerar um novo token forte** |

## Passo a passo

1. **Congelar emissões.** Avise a equipe para não gerar novas faturas durante a
   janela. Não há migração de dados: faturas sandbox e produção são separadas.

2. **Pegar a chave de produção.** No painel Asaas (produção) →
   *Integrações → Chave de API* → copie a API Key de produção.

3. **Gerar o token de webhook.** Crie um segredo forte (ex.: `openssl rand -hex 24`).
   Ele será usado nos dois lados (no `.env` e no cadastro do webhook no Asaas).

4. **Atualizar o `.env`** com os 3 valores de produção da tabela acima e salvar.

5. **Reiniciar a API** (`npm run start:prod` ou o gerenciador de processo, ex.: `pm2 restart`).
   Confirme nos logs que subiu sem erro.

6. **Cadastrar o webhook no Asaas (produção).** Painel → *Integrações → Webhooks*
   → *Adicionar*:
   - **URL:** `https://SUA_API_PUBLICA/financeiro/webhooks/asaas`
   - **Token de autenticação:** o mesmo `ASAAS_WEBHOOK_TOKEN` do `.env`
     (o Asaas envia no header `asaas-access-token`, que a API valida).
   - **Eventos:** marque ao menos `PAYMENT_RECEIVED`, `PAYMENT_CONFIRMED` e
     `PAYMENT_OVERDUE` (são os que a API trata hoje).
   - **Versão da API:** v3. **Email de falha:** cadastre um e-mail de monitoramento.

7. **Teste ponta a ponta (com valor real baixo, ex.: R$ 1,00):**
   - Gere uma fatura: `POST /financeiro/faturas/gerar/:contratoId` de um contrato de teste.
   - Confirme que a fatura aparece no painel Asaas **de produção**.
   - Pague essa fatura de R$ 1,00.
   - Verifique nos logs da API: webhook recebido → fatura marcada `PAGO` →
     **ferramentas liberadas** → WhatsApp de recibo (e e-mail, se SMTP configurado).
   - No painel Asaas, a aba do webhook deve mostrar entrega **200 OK**.

8. **Validar o caminho de inadimplência** (opcional, se quiser confirmar agora):
   simule/aguarde um `PAYMENT_OVERDUE` e confira o bloqueio automático de acesso.

## Verificação de sucesso (checklist)

- [ ] `ASAAS_API_URL` aponta para `https://api.asaas.com/v3`.
- [ ] Fatura de teste apareceu no Asaas de produção.
- [ ] Pagamento disparou o webhook com **200 OK** no painel.
- [ ] Log mostrou liberação de ferramentas e envio de recibo.
- [ ] Nenhum erro `401` de token no log (se houver, o `ASAAS_WEBHOOK_TOKEN` do
      `.env` e o do webhook estão diferentes).

## Rollback

Se algo der errado, reverter é imediato e seguro:

1. Volte as 3 variáveis do `.env` para os valores de **sandbox**.
2. Reinicie a API.
3. (Opcional) Desative o webhook de produção no painel do Asaas.

Como faturas de produção e sandbox são independentes, o rollback não corrompe
dados — apenas volta a apontar para o ambiente de teste. Faturas de produção já
emitidas continuam válidas no painel do Asaas e podem ser reprocessadas quando
você refizer o go-live.

## Pós go-live

- Remova/!comente a chave de sandbox do `.env` para evitar uso acidental.
- Garanta que a URL pública da API tenha HTTPS válido (o Asaas exige).
- Monitore os primeiros pagamentos reais pelos logs e pela aba de webhooks do Asaas.
