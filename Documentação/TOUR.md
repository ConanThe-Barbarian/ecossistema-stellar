# Tour de Funcionalidades — Ecossistema Stellar

Guia para você percorrer e validar tudo que foi aplicado nas últimas sessões.
Marque os `[ ]` conforme testar. Cada item tem: **como testar**, **o esperado** e
observações quando depende de configuração externa.

> Atualizado em 16/06/2026.

---

## 0. Pré-requisitos

- [ ] Backend no ar: na raiz `D:\Ecossistema Stellar` → `npm run start:dev`
- [ ] Portal no ar: `cd portal` → `npm install` (tem deps novas: lucide-react) → `npm run dev`
- [ ] Logar como fundador (Stellar) e, idealmente, ter também um usuário de um cliente para comparar as visões.
- [ ] Banco Azure pode estar "dormindo" na 1ª chamada — se der timeout, tente de novo.

Legenda de dependências externas:
- **(SMTP)** precisa do Mailtrap configurado no `.env` — já está.
- **(Asaas)** precisa do ngrok + webhook configurado (sandbox) — já testado.
- **(Evolution)** precisa da instância WhatsApp conectada — pendente (não bloqueia o resto).
- **(Vertex)** precisa de credenciais Google — pendente.

---

## 1. Visual / Identidade (redesign)

- [ ] Abrir o portal. **Esperado:** fundo deep space, fonte Poppins, acento cyan, logo da Stellar na sidebar e no login, favicon da Stellar na aba.
- [ ] Conferir que **não há emoji** em lugar nenhum do portal — só ícones (lucide) na navegação e símbolos discretos.
- [ ] Reduzir a janela (mobile). **Esperado:** a sidebar vira menu no topo (responsivo).

## 2. Login + MFA (verificação em duas etapas) **(SMTP)**

- [ ] Página **Conta** → seção 2FA → **Ativar**. **Esperado:** status muda para "Ativada".
- [ ] Sair e logar de novo. **Esperado:** após e-mail+senha, a tela pede um **código de 6 dígitos**.
- [ ] Conferir o e-mail (Mailtrap) → digitar o código. **Esperado:** entra normalmente.
- [ ] Testar código errado. **Esperado:** "Código incorreto".
- [ ] Voltar em **Conta** → **Desativar** 2FA (volta ao login simples).

## 3. Trocar senha **(SMTP não necessário)**

- [ ] **Conta** → "Trocar senha": senha atual + nova (mín. 8) + confirmar.
- [ ] **Esperado:** "Senha alterada com sucesso". Testar logar com a nova senha.
- [ ] Senha atual errada → **Esperado:** "Senha atual incorreta".

## 4. Pop-up personalizado (sem o alerta feio do navegador)

- [ ] Em qualquer ação de remover/cancelar (ex.: Torre de Controle → Planos → Remover).
- [ ] **Esperado:** abre um **modal escuro da Stellar** (não o pop-up branco do Chrome), com botão de ação em vermelho e "Cancelar".
- [ ] Kanban → ícone de relógio (apontar horas) → **Esperado:** modal com campo numérico.

## 5. Chamados — tipos e visibilidade (regra de negócio)

- [ ] **Novo chamado** → campo **"Destino"**: escolher "Para a Stellar" ou "Interno".
- [ ] Abrir um **interno** e um **para a Stellar** (como cliente).
- [ ] Na lista **Chamados**: coluna **Empresa**, badge de **tipo** (Interno / Stellar) e **filtro por empresa** (aparece quando há mais de uma).
- [ ] **Visibilidade (o ponto crítico):**
  - [ ] Como **cliente**: vê só os chamados da própria empresa (internos + os abertos pra Stellar).
  - [ ] Como **Stellar (fundador)**: vê só os chamados **abertos para a Stellar** + os **internos da própria Stellar**. **NÃO** deve ver os internos de outras empresas.
- [ ] Regra: só o admin da empresa (com permissão) consegue abrir "Para a Stellar"; sem permissão → erro.
- [ ] **Limite de treinamento:** abrir 2 chamados de categoria "Treinamento" no mês; na 3ª tentativa → **erro "Limite de 2 solicitações de treinamento por mês"** (renova no mês seguinte).

## 6. Chat do chamado

- [ ] Clicar num chamado → abre o detalhe com a conversa.
- [ ] Enviar mensagem. **Esperado:** aparece na hora; e a conversa **atualiza sozinha a cada 15s**.
- [ ] Anexos existentes aparecem como **botões com clipe** (clicáveis, abrem o arquivo).
- [ ] **Anexar arquivo:** no compositor, botão "Anexar arquivo" → escolher um arquivo → aparece um chip com o nome (e X para remover) → enviar. **Esperado:** a mensagem entra com o anexo clicável. Pode anexar sem digitar texto (a mensagem vira "Anexo: nome").
- [ ] **Nota interna (só Stellar):** logado como Stellar, marcar **"Nota interna"** + usar **"@ marcar colega"**. **Esperado:** a nota fica destacada (amarela) e o **cliente não a vê**.

## 7. Financeiro (cliente)

- [ ] **Financeiro:** lista de faturas com status (EM DIA / VENCIDA / PAGO).
- [ ] Fatura com link → botões **"Boleto / PIX"** e **"Copiar código"** (linha digitável).
- [ ] Botão **"Relatório Mensal"** → baixa um PDF.
- [ ] **Pagar quando em débito:** com a empresa EM DÉBITO, o **Início** mostra um banner vermelho "Pagamento pendente" com botão **"Pagar agora"** (gera a cobrança no Asaas e abre o boleto/PIX). Pagando, o webhook do Asaas reativa o acesso às ferramentas.
- [ ] **Verificar pagamento (reconciliação):** botão "Verificar pagamento" na fatura → consulta o Asaas direto e marca como PAGA + reativa acesso, **mesmo sem o webhook** (útil quando o ngrok está fora). Depois de pagar a cobrança, clique nele → a fatura vira PAGO.

## 8. Sino de notificações

- [ ] Ícone de sino no topo. **Esperado:** badge com a contagem; ao abrir, lista faturas em aberto/vencidas e chamados aguardando resposta; clicar leva à página certa.

## 9. Torre de Controle (só Stellar)

- [ ] Logar como Stellar. **Esperado:** **não** aparecem Início/Financeiro/Minhas Ferramentas; cai direto no Dashboard.
- [ ] **Dashboard:** MRR, churn, faturas, chamados, gráfico.
- [ ] **Resumo de Clientes** (novo): seletor de mês + cards de totais (recebido, em aberto, inadimplentes) + tabela por cliente (faturado, recebido, situação, chamados).
- [ ] **Margem & Rentabilidade** (antigo "DRE & Rateio"): consolidado + por cliente + custos fixos.
- [ ] **Consumo:** alertas de desvio + lançar consumo do mês.
- [ ] **Clientes:** "+ Novo cliente" (cadastra empresa) e "Remover".
- [ ] **Contratos:** "+ Novo contrato" (empresa + plano com valor automático + dia de vencimento) e "Cancelar".
- [ ] **Planos:** "+ Criar plano" e "Remover".
- [ ] **Usuários:** "+ Novo usuário" (com seletor de empresa e perfil) e "Remover".
- [ ] **Kanban:** arrastar cartões entre colunas (muda status), relógio (apontar horas), alerta de SLA violado.

## 10. Fluxo financeiro Asaas (sandbox) **(Asaas)**

- [ ] `POST /financeiro/faturas/setup-cobaia` (token de fundador) → cria/reaproveita empresa+plano+contrato de teste, retorna `contrato_id`.
- [ ] `POST /financeiro/faturas/gerar/:contratoId` → **Esperado:** fatura criada no Asaas (status 201) + **e-mail "fatura disponível"** (SMTP).
- [ ] Simular pagamento no painel Asaas (ou webhook) → **Esperado:** webhook responde 200 na hora; nos logs: fatura PAGO, ferramentas liberadas, **e-mail "pagamento confirmado"**.
- [ ] `PAYMENT_OVERDUE` → bloqueia o acesso às ferramentas.

## 11. Segurança / Blindagem (verificação técnica)

- [ ] Token de cliente em rota de gestão (ex.: `/financeiro/dre`) → **403**.
- [ ] Webhook Asaas sem token → **401** (e log de tentativa).
- [ ] Erros retornam JSON limpo (sem stack trace pro cliente).
- [ ] Rate limiting ativo (muitas chamadas rápidas → 429), exceto no webhook.

## 12. Qualidade

- [ ] `npm test` na raiz → **Esperado: 30 testes / 8 suites verdes**.
- [ ] `cd portal && npm run build` → compila sem erros.
- [ ] CI (GitHub Actions): o workflow `.github/workflows/ci.yml` roda typecheck + testes a cada push (confirmar na aba Actions do GitHub após o próximo push).

---

## Pendências conhecidas (para você decidir os próximos passos)

- **WhatsApp (Evolution):** conectar a instância `Stellar_Syntec` para as mensagens saírem (hoje o sistema funciona e só loga a falha).
- **n8n:** preencher `N8N_WEBHOOK_URL` real (disparos de eventos).
- **IA (Vertex):** preencher credenciais Google para ativar resumo/sentimento/sugestão nos chamados.
- **Upload de anexo pela tela do chat** (backend já pronto).
- **Emojis nos logs do backend** (cosmético, console dev — opcional).
- **Go-live Asaas produção:** ver `RUNBOOK-GOLIVE-ASAAS.md`.
- **Observabilidade** (Sentry/health-check) e ampliação de testes (SLA/DRE/portal e2e).
