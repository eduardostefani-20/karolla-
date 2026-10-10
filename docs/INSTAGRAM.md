# Instagram

Duas coisas diferentes, com exigências diferentes:

| Recurso | Precisa de | Status |
|---|---|---|
| Botão **“Ver Instagram”** (rodapé, catálogo de inspirações) | só o @ ou link do perfil em *Painel → Configurações → Instagram* | pronto; aparece assim que o campo é preenchido |
| **Publicações reais do perfil** no site (`/inspiracoes`, seção “No Instagram”) | API oficial da Meta + token de acesso | pronto no código; desligado até existir o token |

O sistema **não** usa scraping, **não** pede a senha do Instagram e **não** inventa endereço:
com o campo vazio o botão simplesmente não aparece.

## 1. Botão “Ver Instagram”

*Painel → Configurações → Instagram*: aceite `@karollapet`, `karollapet` ou
`https://www.instagram.com/karollapet/` (o sistema normaliza para o link do perfil).
Coloque **o perfil oficial real** — o exemplo acima é só o formato.

## 2. Publicações reais (API oficial da Meta)

A antiga *Instagram Basic Display API* foi encerrada pela Meta em dezembro de 2024.
O caminho oficial atual é a **Instagram API with Instagram Login**, usada aqui
(`GET https://graph.instagram.com/<versão>/me/media`).

### Requisitos
1. Conta do Instagram **Profissional** (Empresa ou Criador de conteúdo) — a conversão é gratuita
   no app do Instagram: *Configurações → Tipo de conta e ferramentas*.
2. Um app em <https://developers.facebook.com> (tipo **Empresa**) com o produto **Instagram** →
   *API setup with Instagram login*.
3. Permissão **`instagram_business_basic`** (leitura do próprio perfil e das próprias publicações).
   Como o app só lê a conta da própria Karolla Pet, adicionada como testadora/administradora do app,
   não é preciso App Review para esse uso.
4. Gerar o **token de longa duração** (60 dias) em *API setup with Instagram login →
   Generate access tokens*, entrando com a conta do Instagram da Karolla Pet **na tela da Meta**
   (nunca informe a senha a terceiros ou neste sistema).

### Onde colocar o token
Só no servidor — nunca no front-end, no código ou no repositório:

*Netlify → Site configuration → Environment variables*

| Variável | Valor |
|---|---|
| `INSTAGRAM_ACCESS_TOKEN` | o token gerado (marque como **secreta**, escopo *Functions*) |
| `INSTAGRAM_API_VERSION` | opcional (padrão `v23.0`) |

Depois faça um novo deploy (*Deploys → Trigger deploy*). Em *Painel → Configurações → Status*,
a linha “Publicações do Instagram” passa a mostrar “API oficial da Meta conectada”.

### Renovação (a cada 60 dias)
O token de longa duração expira em 60 dias. Antes disso, renove (o token precisa ter mais de 24 h):

```
GET https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=<TOKEN_ATUAL>
```

ou gere outro no painel da Meta, e atualize `INSTAGRAM_ACCESS_TOKEN` no Netlify.
Se o token expirar, o site **continua funcionando**: a seção de publicações some e o resto
(catálogo, Stories, agendamento) não é afetado.

### Comportamento do servidor
- resultado em cache por 30 minutos (poupa o limite de chamadas da Meta);
- falha da Meta → usa o último resultado bom ou lista vazia, sem quebrar a página;
- só exibe imagem, vídeo (com capa) e carrossel; cada item leva ao post original no Instagram.

## Stories e inspirações não dependem da Meta
Os Stories de 24 h e o catálogo de inspirações do site são publicados **pelo painel** e
guardados no Supabase (Storage `karolla-media`). Eles não são copiados do Instagram nem enviados
para ele: o site funciona igual com ou sem a integração da Meta.
