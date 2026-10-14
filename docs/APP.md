# App instalável (PWA)

O site funciona como **app**: o cliente (ou a equipe) instala pelo navegador, sem loja de aplicativos.
O app ganha ícone na tela do celular, abre em tela cheia (sem a barra do navegador) e se atualiza
sozinho junto com o site. Não há uma versão de app separada para publicar.

## Como instalar
- **Android (Chrome)**: no rodapé do site, toque em **Instalar o app** (ou menu ⋮ → *Instalar app*).
- **iPhone (Safari)**: Compartilhar → **Adicionar à Tela de Início**. O botão "Instalar o app" mostra
  esse passo a passo.
- **Computador (Chrome/Edge)**: use o ícone de instalar na barra de endereço ou o botão do rodapé.

No Android, ao segurar o ícone aparecem os atalhos **Agendar**, **Minha conta** e **Painel da equipe**.

## Como funciona
| Arquivo | Para quê |
|---|---|
| `frontend/public/manifest.webmanifest` | nome, cores, ícones e atalhos do app |
| `frontend/public/sw.js` | service worker: guarda só os arquivos do site para abrir rápido; **nunca** guarda dados da API, login ou fotos de clientes |
| `frontend/public/offline.html` | tela "Você está sem internet" |
| `frontend/public/icon-*.png` | ícones de 192 e 512 px, mais a versão "maskable" (o Android recorta em círculo ou quadrado) |
| `frontend/src/services/pwa.ts` | registra o service worker (só no site publicado) e o convite de instalação |

Para obrigar todos a baixarem uma versão nova do service worker, troque `VERSION` em `sw.js`.

## Lojas (Google Play e App Store): opcional, no futuro
- **Google Play**: dá para publicar este mesmo app como "Trusted Web Activity" (por exemplo, com o
  PWABuilder). Exige conta de desenvolvedor do Google (taxa única de US$ 25).
- **App Store (iPhone)**: a Apple exige app nativo ou empacotado e conta de US$ 99 por ano, e costuma
  recusar apps que são só um site. No iPhone, o "Adicionar à Tela de Início" já entrega a experiência
  de app.
