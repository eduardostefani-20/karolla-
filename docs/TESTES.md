# Testes

| Comando | Escopo |
|---|---|
| `npm test -w shared` | motor de preços, disponibilidade, validações, máscara, dinheiro, sanitização |
| `npm test -w backend` | API ponta a ponta com supertest (banco em memória, relógio fixo) |
| `npm test -w frontend` | schemas dos formulários, combobox de raças |
| `npm run test:e2e` | Playwright: site → agendamento → confirmação; login → painel → edições → site (desktop e celular) |
| `./database/scripts/test-local.sh` | migrations, funções atômicas e RLS em PostgreSQL |

## Matriz da especificação (seção 51)

| Cenário | Onde |
|---|---|
| Formulário incompleto | `backend/tests/booking.test.ts`, `e2e/booking.spec.ts` |
| Telefone inválido / e-mail inválido | backend, shared, frontend, e2e |
| Data passada | `shared/tests/availability.test.ts`, backend |
| Horário ocupado (e requisições simultâneas) | backend, `database/tests` |
| Serviço / adicional desativado | shared, backend |
| Cálculo de preço | `shared/tests/pricing.test.ts`, e2e (total em tempo real) |
| Login inválido / acesso direto a rota admin | `backend/tests/admin.test.ts`, `e2e/admin.spec.ts` |
| Edição de preço, criação de serviço, exclusão/desativação | backend, e2e (com verificação no site) |
| Agendamento completo | backend, e2e |
| Erro de banco / WhatsApp / Google Sheets | `backend/tests/booking.test.ts` |
| Mobile e desktop | e2e (projetos `desktop` e `mobile`) |

O E2E usa o Chromium do Playwright; em ambientes com navegador próprio, defina `PW_CHROMIUM_PATH`.
