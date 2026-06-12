# Roteiro de Testes — Ecossistema Stellar

> Checklist ponta a ponta para validar tudo que foi desenvolvido.
> Pré-requisito: API (`npm run start:dev`) e portal (`cd portal && npm run dev`) rodando.

## 1. Autenticação & Permissões

- [ ] Login no portal com fundador (conan@stellarsyntec.com) → entra e vê a seção "Torre de Controle" na sidebar
- [ ] Login com cliente (admin@escolademusica.com) → entra e NÃO vê a Torre de Controle
- [ ] Cliente tentando acessar `/admin` direto pela URL → redirecionado para Início
- [ ] Logout e login com senha errada → mensagem "E-mail ou senha incorretos"

## 2. Portal do Cliente

- [ ] **Início**: plano atual, situação (EM DIA/EM DÉBITO) e próxima fatura aparecem
- [ ] **Minhas Ferramentas**: ferramentas do contrato listadas; bloqueada aparece com badge vermelho e sem botão
- [ ] **Financeiro**: histórico de faturas com status e link de boleto
- [ ] **Financeiro → Relatório Mensal**: clica no botão e baixa o PDF (precisa ter visitado Início antes)
- [ ] **Chamados**: abrir novo chamado → aparece na lista com SLA calculado
- [ ] **Chamado → clicar na linha**: abre o detalhe com status, técnico e prazo
- [ ] **Detalhe → enviar mensagem**: mensagem aparece na conversa
- [ ] Ações rápidas do Início (Treinamento / Visita Presencial) pré-preenchem o formulário

## 3. Torre de Controle (login de fundador)

- [ ] **Dashboard**: MRR, clientes ativos, churn, faturas a receber, chamados e gráfico de evolução
- [ ] **DRE & Rateio**: selecionar o mês → consolidado + tabela por cliente com lucro ÷ 3
- [ ] **DRE → cadastrar custo fixo geral** (sem cliente) → DRE rateia entre os clientes
- [ ] **DRE → cadastrar custo fixo de um cliente** → aparece só na linha dele
- [ ] **Consumo**: registrar consumo do mês → aparece na tabela; com histórico de meses anteriores, o desvio % e a situação calculam
- [ ] **Clientes**: lista com CNPJ formatado, contratos e usuários; busca funciona

## 4. Automação financeira (Asaas sandbox)

- [ ] Gerar fatura: `POST /financeiro/faturas/gerar/:contratoId` → fatura criada no Asaas + WhatsApp de fatura disponível
- [ ] Simular pagamento no painel sandbox do Asaas → webhook recebe → log mostra:
      fatura liquidada → **ferramentas liberadas** → WhatsApp com recibo
- [ ] Simular `PAYMENT_OVERDUE` → log mostra alerta de atraso + **ferramentas bloqueadas**
- [ ] Após bloqueio, no portal do cliente a ferramenta aparece "ACESSO BLOQUEADO" e sem token SSO
- [ ] Pagar a fatura vencida → ferramentas liberam de novo (só se não houver outra vencida)

## 5. Crons (testar mudando temporariamente a expressão para `*/2 * * * *`)

- [ ] Lembrete de vencimento (9h, faturas a 1/3/7 dias) → WhatsApp
- [ ] Relatório mensal automático (dia 1, 8h) → PDF gerado + webhook RELATORIO_MENSAL_GESTAO no n8n

## 6. APIs administrativas (via curl/Insomnia com token de fundador)

- [ ] `GET /dashboard/executivo?mes=2026-06`
- [ ] `GET /financeiro/dre?mes=2026-06`
- [ ] `GET /financeiro/consumo/alertas?mes=2026-06`
- [ ] `POST /empresas` (criar empresa de teste) e `DELETE /empresas/:id` (bloqueado se houver contrato ativo)
- [ ] `POST /financeiro/contratos` + `POST /financeiro/contratos/:id/ferramentas`
- [ ] `POST /usuarios` (criar usuário para a empresa de teste) e login com ele
- [ ] `PATCH /usuarios/:id/senha` (reset de senha)

## 7. Segurança (testes negativos)

- [ ] Token de cliente chamando `GET /financeiro/dre` → 403
- [ ] Token de cliente chamando `GET /empresas` → 403
- [ ] Cliente A chamando `GET /relatorios/exportar/cliente/<empresa B>` → 401
- [ ] Webhook Asaas sem o token correto no header → 401 + log de "tentativa de invasão"
- [ ] Requisição sem JWT em qualquer rota protegida → 401

## Configurações opcionais pendentes

- `CHATWOOT_PLATFORM_URL` / `CHATWOOT_PLATFORM_TOKEN` no `.env` + `?cw_account=<id>`
  na url_acesso da ferramenta → ativa suspensão automática no próprio Chatwoot
- `N8N_WEBHOOK_URL` → ativa os disparos para o n8n
- Go-live Asaas: trocar `ASAAS_API_URL` para produção e atualizar a chave
