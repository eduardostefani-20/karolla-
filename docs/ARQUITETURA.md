# Arquitetura

## Visão geral

```
                    KAROLLA PET
                         │
            ┌────────────┴────────────┐
       SITE PÚBLICO                 ADMIN (/admin)
       /  e  /agendar               login → dashboard, agenda, agendamentos,
            │                       clientes, pets, serviços, preços,
            │                       adicionais, formulário, horários, configurações
            └────────────┬────────────┘
                         ↓  HTTP /api (JSON)
                  BACK-END (Express)
     routes → controllers → services → repositories
                         │
            ┌────────────┼──────────────────────┐
     DatabaseService   AuthService     NotificationService
     memory | supabase  mock | supabase   ├─ WhatsAppService (link | cloud_api | disabled)
                                          └─ GoogleSheetsService (webhook | disabled)
```

## Princípios

| Regra | Onde |
|---|---|
| Um único motor de preços (`calculateAppointmentPrice`) usado pelo site **e** pela API | `shared/src/pricing` |
| Uma única regra de disponibilidade (funcionamento, intervalo, bloqueios, antecedência, capacidade) | `shared/src/scheduling` |
| Mesmos schemas Zod no navegador e no servidor; o servidor sempre revalida | `shared/src/validation` |
| Preços, serviços, adicionais, raças, portes, campos e número do WhatsApp vivem no **banco** | painel administrativo |
| UI não contém regra de negócio; controllers não contêm regra de negócio | `frontend/src/components`, `backend/src/services` |
| Implementações trocáveis por interface, escolhidas em um só lugar | `backend/src/container.ts` |

## Fluxo de um agendamento (`POST /api/public/appointments`)

1. **Validação** (Zod) do corpo + campos configuráveis do Editor do Formulário (ativo/obrigatório).
2. Espécie, porte e raça precisam existir e estar ativos (o nome da raça vem do banco, não do navegador).
3. **Preço recalculado no servidor**. Se divergir do total exibido ao cliente → `409 PRICE_CHANGED`
   (o cliente vê o novo valor antes de confirmar).
4. **Pré-checagem de horário** com mensagem específica (passado, fechado, intervalo, bloqueado, ocupado…).
5. Cliente reaproveitado pelo WhatsApp (só completa dados vazios — o formulário público não sobrescreve cadastro);
   pet reaproveitado por nome + espécie.
6. **Gravação atômica**: memória (checagem síncrona) ou Supabase (função `create_appointment` com
   `pg_advisory_xact_lock` por data + checagem de capacidade). Dois clientes no mesmo horário: só um entra.
7. **Integrações** (depois de salvo): WhatsApp → Google Sheets. Falhas são registradas em `integration_logs`
   e **nunca** desfazem o agendamento.

Itens do agendamento (serviços/adicionais) são gravados com nome, preço e duração do momento — mudar a tabela
de preços não altera o histórico.

## Segurança

- Rotas `/api/admin/*` exigem token Bearer válido; configurações exigem perfil `admin`/`owner` (`staff` só opera a agenda).
- Front-end: rotas `/admin/*` redirecionam para `/admin/login` sem sessão; o token é revalidado ao abrir o painel.
- Validação no navegador **e** no servidor; textos livres sanitizados (sem HTML); proteção contra fórmulas em planilhas.
- Helmet, CORS restrito, limite de corpo (100 kb), rate limit (login, agendamentos, API geral), honeypot anti-spam.
- Erros: mensagens amigáveis; detalhes técnicos só no log do servidor.
- Banco: RLS em todas as tabelas; anônimo só lê catálogo ativo; dados pessoais só para administradores;
  gravação de agendamentos apenas pela API (service role) via funções restritas.
- Produção recusa iniciar com banco em memória ou login mock.

## Preparado para crescer

- `appointments.staff_user_id` (múltiplos profissionais) e `customers.user_id` (área do cliente) já existem.
- `business_settings.capacity` + motor de capacidade → mais de um atendimento simultâneo.
- `appointment_services` aceita vários serviços por agendamento (o motor de preços já soma).
- `integration_logs` e `NotificationService` → lembretes/confirmações automáticas viram novos provedores.
- Novas espécies, portes e campos são dados, não código.
