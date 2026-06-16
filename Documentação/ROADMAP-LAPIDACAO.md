# Roadmap de Lapidação — Ecossistema Stellar

> Plano para deixar o projeto completo de ponta a ponta e blindado, partindo do
> estado atual (núcleo funcional validado) até pronto para produção.
> Criado em 15/06/2026.

---

## ✅ Progresso (atualizado em 16/06/2026)

**Concluído:**
- **Redesign do portal** — Design System oficial aplicado (Poppins, `#00001a`, cards `#1b1b32`, acento `#00d4ff`), logo + favicon da Stellar, login/sidebar/cards/tabelas/badges repaginados, layout responsivo.
- **Bloco 1 — Portal completo** — trocar senha pela página Conta; chat dos chamados com anexos clicáveis + auto-refresh (15s); Financeiro com Boleto/PIX e copiar linha digitável.
- **Bloco 2 — Blindagem** — webhook Asaas assíncrono (responde 200 na hora + `@SkipThrottle`); filtro global de exceções; ValidationPipe global. (Helmet, CORS restrito, rate limiting e body-limit já existiam.)
- **Bloco 3 — Notificações + CRUD admin** — sino de notificações no portal (`/portal/notificacoes`); CRUD visual de Empresas, Contratos, Planos e Usuários na Torre de Controle.

**Em aberto (próximos):**
- **Bloco 4 — Testes ampliados + CI** (specs de SLA/DRE/AcessoService + GitHub Actions).
- Refinos: estados de loading/skeleton, dados da empresa editáveis na Conta, alinhar e-mails/PDF ao Design System.
- Itens que dependem de você/infra: conectar EvolutionAPI (WhatsApp), preencher `N8N_WEBHOOK_URL`, configurar Vertex, rotacionar segredos de teste, go-live Asaas.

> Estado técnico: backend e portal com typecheck limpo; 26 testes automatizados verdes.
> Pendência operacional: os commits ainda **não foram enviados** ao GitHub (push é feito por você na máquina).

---

## 0. Design System oficial (extraído de stellarsyntec.com.br)

Tokens reais do site, para alinhar **portal + e-mails + relatórios PDF**:

| Token | Valor |
|---|---|
| Fonte | **Poppins** (sans-serif) |
| Fundo principal | `#00001a` (deep space) |
| Superfície / cards | `#1b1b32` |
| Gradiente de painel | `linear-gradient(135deg, #0a0a1f, #0d0d26)` |
| Acento neon (cyan) | `#00d4ff` |
| Borda de destaque | `rgba(0, 212, 255, 0.3)` |
| Texto | `#fafafa` |
| Texto secundário | `#b3b3b3` |
| Logo | `https://stellarsyntec.com.br/assets/logo-BezJfNUT.png` |
| Tagline | "Onde a tecnologia encontra o Infinito" |

> Hoje o portal usa glassmorphism roxo e os e-mails usam Space Grotesk + `#22d3ee`.
> A lapidação alinha tudo para o padrão acima.

---

## 1. Redesign do Portal do Cliente  — *Prioridade P0*

- [ ] Criar `theme.css` com as variáveis do Design System (tokens acima).
- [ ] Trocar a fonte para **Poppins** (Google Fonts) em todo o portal.
- [ ] Substituir o logo textual "✦ Stellar" pela **logo oficial** (baixar para `portal/public/`).
- [ ] Definir o **favicon** com a logo da Stellar.
- [ ] Repaginar **Login** (hero com tagline, vidro sobre fundo deep space).
- [ ] Repaginar **sidebar**, **cards**, **tabelas**, **badges** e **botões** no novo padrão.
- [ ] Estados de **loading** e **vazio** consistentes (skeletons).
- [ ] **Responsividade** (sidebar colapsável no mobile).
- [ ] Alinhar **e-mails transacionais** e **PDF de relatório** ao mesmo Design System.

## 2. Completar funcionalidades do Portal do Cliente — *P0/P1*

- [ ] **Chat dos chamados** (já existe o detalhe com interações): deixar acessível
      e fluido — abrir o chamado ao clicar, mostrar anexos, atualização por polling,
      indicador de mensagens novas.
- [ ] **Anexos**: upload/preview de imagens e PDF na conversa (endpoints já existem).
- [ ] **Trocar senha pelo portal** (hoje só via CLI `resetar-senha.ts`).
- [ ] **Financeiro**: copiar linha digitável / PIX, abrir boleto, baixar comprovante,
      histórico completo com filtro.
- [ ] **Sino de notificações** (fatura nova, chamado respondido, pagamento confirmado).
- [ ] **Minhas Ferramentas**: deixar claro o estado ATIVO/BLOQUEADO e o SSO do GalaxIA.
- [ ] **Ações rápidas** do Início (Treinamento / Visita / Suporte) realmente funcionais.

## 3. Torre de Controle (Admin) — completar — *P1*

- [ ] CRUD **visual** de empresas, contratos, planos e usuários (hoje só via API).
- [ ] Gestão de chamados fora do Kanban (atribuir técnico, alterar prioridade/SLA).
- [ ] Tela de **consumo/IA** integrada (resumo, sentimento, sugestão já no backend).
- [ ] Exportações (DRE, faturas) em CSV/PDF.

## 4. Blindagem (segurança & robustez) — *P0/P1*

- [ ] **Webhook Asaas assíncrono**: responder `200` na hora e processar em segundo
      plano (evita a fila ser pausada por lentidão/erro — já aconteceu).
- [ ] **Helmet** (headers de segurança) + **CORS** restrito ao domínio do portal.
- [ ] Revisar **rate limiting** (`@nestjs/throttler` já está nas deps) nas rotas sensíveis.
- [ ] **Filtro global de exceções** + logs estruturados (sem vazar stack ao cliente).
- [ ] **Rotacionar segredos** que apareceram em testes (Mailtrap, etc.) antes de produção.
- [ ] Confirmar que **todas** as rotas têm DTO + validação (class-validator).
- [ ] Reduzir verbosidade do **Prisma log** em produção.

## 5. Confiabilidade & Infra — *P1/P2*

- [ ] **Azure SQL serverless** pausa quando ocioso: aplicar retry/warm-up no boot
      (já há retry nos crons) ou avaliar tier que não pausa.
- [ ] **EvolutionAPI**: conectar a instância `Stellar_Syntec` (WhatsApp) + healthcheck.
- [ ] **n8n**: preencher `N8N_WEBHOOK_URL` real e validar os fluxos (sem TypeBot).
- [ ] Substituir **ngrok** (dev) por URL pública HTTPS em produção.
- [ ] Endpoint **/health** (DB, Asaas, Evolution).

## 6. Qualidade & Testes — *P1*

- [ ] Ampliar testes: SLA, DRE, AcessoService (liberar/bloquear), portal (e2e).
- [ ] **CI** (GitHub Actions): typecheck + build + testes a cada push/PR.
- [ ] Teste e2e do fluxo crítico (login → fatura → pagamento).

## 7. Observabilidade — *P2*

- [ ] Error tracking (ex.: Sentry) no backend e no portal.
- [ ] Métricas básicas (faturas geradas, webhooks recebidos, falhas de notificação).

## 8. Deploy / Go-live — *P2/P3*

- [ ] Definir hospedagem do **backend** (Azure/Hostinger) e do **portal** (estático).
- [ ] Variáveis de produção, domínios e HTTPS.
- [ ] Seguir `RUNBOOK-GOLIVE-ASAAS.md` na virada de sandbox → produção.
- [ ] Configurar **SPF/DKIM/DMARC** no domínio para o e-mail não cair em spam.

---

## Ordem sugerida de execução

1. **Design System + Redesign do Portal** (item 1) — maior impacto visível.
2. **Chat e funcionalidades do portal** (item 2).
3. **Blindagem do webhook + segurança** (item 4).
4. **CRUD admin** (item 3) e **testes/CI** (item 6).
5. **Infra, observabilidade e deploy** (itens 5, 7, 8).

## Já entregue (base sólida do projeto)

Portal do cliente v1, Torre de Controle (dashboard/DRE/consumo/clientes/Kanban),
automação financeira Asaas (gerar fatura, webhook pagamento → libera/bloqueia +
recibo), e-mail transacional, MFA por e-mail, omnichannel WhatsApp (inbound),
IA Vertex (env-gated), relatórios PDF, RBAC multi-tenant + bypass Super Admin,
SLAs, atribuição automática de chamados, 20 testes automatizados.
