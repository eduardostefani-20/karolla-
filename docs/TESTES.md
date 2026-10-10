# Testes

| Comando | Escopo |
|---|---|
| `npm test -w shared` | motor de preços, disponibilidade, validações, máscara, dinheiro, sanitização |
| `npm test -w backend` | API ponta a ponta com supertest (banco em memória, relógio fixo) |
| `npm test -w frontend` | schemas dos formulários, combobox de raças |
| `npm run test:e2e` | Playwright: site → agendamento → confirmação; login → painel → edições → site; inspiração → agendamento → painel; agenda por profissional; Stories (desktop e celular) |
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

## Inspirações, Stories e agenda por profissional

| Cenário | Onde |
|---|---|
| Foto escolhida chega ao agendamento certo e fica salva no painel (inclusive após recarregar) | `e2e/instagram-features.spec.ts`, `backend/tests/features.test.ts` |
| Foto anexada não altera serviços, preços, horários nem etapas | e2e (total igual ao do serviço), backend |
| Inspiração editada/ocultada depois: o agendamento mantém a foto original (snapshot) | backend |
| Inspiração usada em agendamento não pode ser excluída | backend |
| Agendamentos antigos (sem foto/profissional) continuam abrindo, editando e remarcando | `e2e/booking.spec.ts`, `e2e/admin.spec.ts`, backend |
| Story some após 24 h (relógio simulado: 23 h 59 visível, 24 h oculto) e limpeza apaga o arquivo | backend, `database/tests/profissionais_stories.test.sql` |
| Visitante não publica Story/inspiração nem pede URL de upload | backend (401), RLS no banco |
| Upload: tipo e tamanho validados, token de uso único | backend |
| Uma profissional = um pet por vez; com 2 profissionais, 2 pets no mesmo horário | `shared/tests/availability.test.ts`, backend, banco |
| Instagram sem token não chama a Meta; com token usa a API oficial e cache | backend (fetch simulado) |

## Anúncios, LGPD e origem dos agendamentos

| Cenário | Onde |
|---|---|
| Sem pixels configurados: sem aviso de cookies e sem scripts de terceiros | `e2e/anuncios.spec.ts` |
| Recusar cookies: nenhum pixel carrega (nem após recarregar) | e2e |
| Aceitar (pelo rodapé): Meta, Google Ads e TikTok carregam | e2e (scripts simulados) |
| Agendamento concluído envia `Schedule`/conversão com valor em R$ e ID único | e2e |
| Painel nunca carrega pixels | e2e |
| IDs validados e normalizados (ex.: código colado no lugar do ID é recusado) | `backend/tests/marketing.test.ts`, e2e |
| Origem (UTM, gclid, fbclid, ttclid, site de origem) limpa, gravada e exibida no painel e no Dashboard | backend, e2e, `shared/tests/attribution.test.ts` |
| Origem inválida nunca impede o agendamento | backend, `database/tests/anuncios_origem.test.sql` |

O E2E usa o Chromium do Playwright; em ambientes com navegador próprio, defina `PW_CHROMIUM_PATH`.
