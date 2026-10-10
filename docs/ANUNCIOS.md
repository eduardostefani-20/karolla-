# Anúncios e tráfego pago (Meta, Google Ads e TikTok)

O site já está pronto para campanhas: pixels das três plataformas, aviso de cookies (LGPD),
evento de conversão no agendamento concluído e relatório de **origem dos agendamentos** no painel.
Você só precisa criar as contas de anúncio e colar os **IDs** em *Painel → Configurações → Anúncios*.
Os IDs não são segredos (aparecem no código de qualquer site com pixel), então ficam no painel, sem novo deploy.

## O que o site envia

| Momento | Meta | TikTok | Google Ads |
|---|---|---|---|
| Abriu qualquer página | `PageView` | `page` | `page_view` |
| Abriu uma inspiração de tosa | `ViewContent` | `ViewContent` | — |
| Começou um agendamento | `InitiateCheckout` | `InitiateCheckout` | `begin_checkout` |
| **Agendamento concluído** (com valor em R$) | **`Schedule`** | **`Schedule`** | **conversão “Agendamento”** |
| Tocou em um link do WhatsApp | `Contact` | `Contact` | conversão “WhatsApp” (opcional) |

Cada agendamento leva um identificador único (`eventID` / `event_id` / `transaction_id`), então a mesma
conversão não é contada duas vezes, e já fica pronto para uma integração por servidor no futuro.

**LGPD:** nenhum pixel carrega antes de o visitante tocar em **Aceitar** no aviso de cookies.
Quem recusa usa o site normalmente. O painel (`/admin`) nunca carrega pixels. A página
[`/privacidade`](https://karollapet.com.br/privacidade) explica tudo e o rodapé tem “Preferências de cookies”.
Peça para quem cuida da parte jurídica revisar o texto da política.

## 1. Meta (Instagram e Facebook)
1. Em <https://business.facebook.com> → **Gerenciador de Eventos** → *Conectar fontes de dados* → **Web** →
   dê um nome (ex.: “Site Karolla Pet”) → crie o pixel (conjunto de dados).
2. Copie o **ID** (só números, ex.: `123456789012345`) e cole em *Painel → Configurações → Pixel da Meta*.
3. *Configurações do negócio → Segurança da marca → Domínios*: adicione `karollapet.com.br` e verifique
   (registro TXT no DNS — veja `docs/DOMINIO.md`).
4. Na campanha, objetivo **Leads** ou **Vendas**, conversão no site, evento **Agendar (Schedule)**.
5. Em cada anúncio, *Parâmetros de URL*:
   ```
   utm_source={{site_source_name}}&utm_medium=paid&utm_campaign={{campaign.name}}&utm_content={{ad.name}}
   ```

## 2. Google Ads
1. Em <https://ads.google.com> → **Metas → Conversões → Nova ação de conversão → Site** → configurar manualmente.
2. Categoria **Agendar** (ou “Envio de formulário de lead”), nome “Agendamento online”,
   valor **“Usar valores diferentes para cada conversão”** (o site envia o total do agendamento), contagem **Uma**.
3. Em *Configurar a tag* → **Instalar a tag por conta própria**: o código mostra
   `send_to: 'AW-123456789/AbCdEfGhIj'`.
   - `AW-123456789` → *Google Ads — ID da tag*
   - `AbCdEfGhIj` (depois da barra) → *Google Ads — rótulo da conversão “Agendamento”*
4. Opcional: crie outra conversão “Clique no WhatsApp” (categoria *Contato*) e cole o rótulo no campo “WhatsApp”.
5. Deixe a **codificação automática** ligada (*Configurações da conta*) — o `gclid` identifica a origem no painel.

## 3. TikTok Ads
1. Em <https://ads.tiktok.com> → **Ferramentas → Eventos → Eventos da Web → Configurar evento da Web** →
   *Pixel do TikTok* → **Instalar o código manualmente**.
2. Copie o **ID do pixel** (letras e números, ex.: `C4ABCDEF123GHIJ456KL`) e cole em *Configurações → Pixel do TikTok*.
3. Na campanha, otimize pelo evento **Agendar (Schedule)**.
4. URL do anúncio com parâmetros:
   ```
   https://karollapet.com.br/?utm_source=tiktok&utm_medium=paid&utm_campaign=__CAMPAIGN_NAME__&utm_content=__CID_NAME__
   ```

## 4. Conferir se está funcionando
1. Abra o site em uma janela anônima e toque em **Aceitar** no aviso de cookies.
2. Use as ferramentas oficiais:
   - Meta: extensão **Meta Pixel Helper** ou *Gerenciador de Eventos → Testar eventos*;
   - Google: <https://tagassistant.google.com>;
   - TikTok: extensão **TikTok Pixel Helper** ou *Eventos → Testar eventos*.
3. Faça um agendamento de teste e veja o evento **Schedule** / conversão aparecer (pode levar alguns minutos).
   Depois, cancele o agendamento no painel.

## 5. Saber quais anúncios trazem clientes (no painel)
- **Dashboard → “De onde vieram os agendamentos (últimos 30 dias)”**: quantidade e valor por origem
  (Meta Ads, Google Ads, TikTok Ads, Instagram orgânico, Google orgânico, acesso direto…).
- **Detalhe do agendamento → “Origem do cliente”**: campanha, anúncio, palavra-chave e de onde veio.

Como a origem é lida:

| No link | Aparece como |
|---|---|
| `gclid` (Google Ads automático) | Google Ads |
| `ttclid` (TikTok automático) | TikTok Ads |
| `utm_medium=paid` (ou `cpc`, `paid_social`…) + `utm_source=instagram/facebook/ig/fb` | Meta Ads (Instagram/Facebook) |
| `utm_source=instagram` sem meio pago (ex.: link da bio) | Instagram/Facebook |
| sem parâmetros, vindo do Google / Instagram | Google / Instagram/Facebook |
| nada | Acesso direto |

Dica: no link da bio do Instagram use `https://karollapet.com.br/?utm_source=instagram&utm_medium=bio`;
no status do WhatsApp, `?utm_source=whatsapp&utm_medium=status`; em panfletos com QR Code,
`?utm_source=panfleto&utm_campaign=bairro-x`.

A origem fica guardada no navegador do cliente por 30 dias (quem viu o anúncio ontem e agendou hoje também conta).

## O que não está incluído (precisa de token secreto)
- **API de Conversões da Meta**, **Events API do TikTok** e **conversões otimizadas do Google**
  (envio pelo servidor, mais preciso com bloqueadores de anúncio). Exigem tokens de acesso que ficam só no
  servidor (variáveis secretas no Netlify). O site já envia os identificadores únicos de cada conversão,
  então dá para ligar depois sem contar em dobro.
