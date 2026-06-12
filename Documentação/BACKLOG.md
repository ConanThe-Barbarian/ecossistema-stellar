# Backlog & Decisões de Negócio — Ecossistema Stellar

> Extraído da conversa original de planejamento (Gemini, abr–mai/2026) e comparado
> com o código atual em 12/06/2026. Itens já implementados foram omitidos.

## 1. Decisões de negócio (não estavam na documentação formal)

- **GalaxIA = Chatwoot whitelabel.** O acesso do cliente ("Minhas Ferramentas")
  usa SSO via token de API do próprio Chatwoot, com login admin padrão definido
  pela Stellar para cada cliente.
- **Super Admin = somente os 3 fundadores** (Conan, Gustavo e Rômulo). O "Gestor
  do Cliente" também tem `can_manage_users`, mas restrito à própria empresa
  (escopo local). A identificação de fundador é pela empresa conter "STELLAR".
- **Regra de abertura de chamados (Cenário B):** usuários comuns do cliente abrem
  chamados internos; somente o Administrador da empresa cliente pode abrir
  chamado para a Stellar (`can_open_stellar_ticket`).
- **Planos:** Start, Scale e Prime com preço fixo; Enterprise sob medida com
  valor definido manualmente no contrato.
- **Treinamento 0800** incluído para quem contrata o GalaxIA; **visita técnica
  presencial é cobrada à parte** (gera faturamento adicional).
- **Consumo variável (tokens):** lançado mensalmente em R$ por cliente; a régua
  de decisão de cobrança de excedente é a comparação com a média histórica dos
  meses anteriores.
- **Relatórios PDF:** cliente nunca vê IDs internos de chamados (só gestores);
  visual dark Stellar (Space Grotesk, cyan neon), gráficos de pizza, ranking por
  técnico incluindo quem fechou zero, data com dia/mês/ano e hora, logo de
  stellarsyntec.com.br/favicon.ico.
- **Infra:** n8n self-hosted na Hostinger; EvolutionAPI em
  adminapi.stellarsyntec.com.br (instância Stellar_Syntec); rede via Radmin VPN
  (obs: banco migrado para Azure SQL em 12/06/2026); Asaas em ambiente
  **sandbox** (trocar chave e URL para produção no go-live).

## 2. Planejado e ainda NÃO implementado

### Alta prioridade
- [x] *(12/06/2026)* **Suspensão/liberação automática do GalaxIA por pagamento.** Quando o
  webhook do Asaas confirmar pagamento (ou detectar inadimplência), bloquear ou
  liberar `ferramentas_contratadas.status_acesso` automaticamente — e via
  Platform Token do Chatwoot, suspender o acesso na própria plataforma. Hoje o
  webhook só baixa a fatura e envia WhatsApp.
- [x] *(12/06/2026)* **Alerta de custos variáveis.** Card/endpoint que compara o consumo do mês
  com a média histórica do cliente e sinaliza desvio (régua para renegociação ou
  cobrança de excedente). O registro de consumo já existe; falta a análise.
- [ ] **Torre de Controle visual** (frontend admin): dashboard executivo com
  gráficos, gestão de clientes/contratos/planos/custos e DRE na tela.

### Média prioridade
- [ ] **Botão "Gerar Relatório Mensal" no portal do cliente** consumindo
  `GET /relatorios/exportar/cliente/:empresaId` (endpoint já existe).
- [ ] **Relatório mensal automático para os gestores** (cron mensal gerando o
  PDF de gestão e disparando via n8n/WhatsApp — o fluxo n8n já foi prototipado).
- [x] *(12/06/2026)* **Detalhe do chamado no portal** (chat de interações + anexos — endpoints
  prontos no backend).
- [ ] **E-mail transacional real** (confirmação de pagamento etc. — hoje é só
  log; integrar SendGrid/Mailtrap ou similar).

### Baixa prioridade / futuro
- [ ] **MFA no login** (campo `mfa_enabled` já existe no banco).
- [ ] **Omnichannel completo**: abertura/atualização de chamados via WhatsApp
  (Typebot + n8n + EvolutionAPI).
- [ ] **IA (Vertex)**: auto-resumo de chamados, análise de sentimento e sugestão
  de respostas.
- [ ] **Kanban dos técnicos** com timer de apontamento de horas.
- [ ] **Go-live Asaas produção**: trocar `ASAAS_API_URL`/`ASAAS_API_KEY`,
  recriar webhook no painel do Asaas apontando para a URL pública da API.

## 3. Já implementado (confirmado no código)

Lembretes de vencimento via Cron diário 9h (1/3/7 dias antes) com WhatsApp;
notificação de fatura gerada; confirmação de pagamento com busca de recibo
(retry); atribuição automática de chamado por peso com webhook n8n; relatórios
PDF dark com Puppeteer; RBAC multi-tenant; SLAs por plano/prioridade; DRE com
rateio /3; portal do cliente v1.
