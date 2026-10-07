# Integrações

Ordem fixa, sempre **depois** de o agendamento estar salvo no banco:

```
BANCO (fonte principal) → WHATSAPP → GOOGLE SHEETS
```

Cada tentativa vira um registro em `integration_logs` (`success`, `failed`, `skipped`, `link_generated`),
visível no painel em *Agendamento → Integrações*, com botão **Reenviar**.

## Interfaces (trocáveis)

| Interface | Implementações | Arquivo |
|---|---|---|
| `DatabaseService` | `MemoryDatabase` (demo), `SupabaseDatabase` | `backend/src/repositories` |
| `AuthService` | `MockAuthService` (demo), `SupabaseAuthService` | `backend/src/integrations/auth` |
| `WhatsAppService` | `WhatsAppLinkProvider`, `WhatsAppCloudApiProvider`, `DisabledWhatsAppProvider` | `backend/src/integrations/whatsapp` |
| `GoogleSheetsService` | `WebhookGoogleSheetsService`, `DisabledGoogleSheetsService` | `backend/src/integrations/sheets` |

A escolha acontece em `backend/src/container.ts` a partir das variáveis de ambiente. Para um novo provedor
(ex.: Z-API, Twilio), implemente a interface e registre-o no container.

## WhatsApp

Mensagem gerada por `buildNewAppointmentMessage()` (`integrations/whatsapp/messageBuilder.ts`):

```
🐾 NOVO AGENDAMENTO — KAROLLA PET
*PET* Nome / Espécie / Raça / Porte / Peso / Idade
*SERVIÇO* · *ADICIONAIS* · *DATA* · *HORÁRIO*
*TUTOR* · *WHATSAPP* · *E-MAIL* · *ENDEREÇO* · *OBSERVAÇÕES*
*TOTAL* · Código
```

- **`link` (padrão)** — gera `https://wa.me/<número>?text=<mensagem>`. Nada é enviado automaticamente; a
  mensagem chega quando o tutor toca em *Falar no WhatsApp* na confirmação. Status: `link_generated`.
- **`cloud_api`** — `POST https://graph.facebook.com/{versão}/{PHONE_NUMBER_ID}/messages` com
  `WHATSAPP_CLOUD_TOKEN`, destino = número da Karolla Pet. Atenção: a Meta só entrega texto livre dentro da
  janela de 24h de conversa; para produção crie um *template* aprovado e adapte `WhatsAppCloudApiProvider`
  para enviar `type: "template"`.
- **`disabled`** — não faz nada (status `skipped`).

O número da Karolla Pet é lido de `business_settings.whatsapp_number` (painel → Configurações).

## Google Sheets

`WebhookGoogleSheetsService` envia `{ action: "upsert", secret, columns, row }` para um Web App do Apps Script
(`docs/google-apps-script.gs`), que insere ou atualiza a linha pela coluna **ID**. Também é chamado quando o
agendamento é editado no painel (ex.: mudança de status). Valores que começam com `= + - @` são escapados.
