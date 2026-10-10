# Deploy

## Checklist
- [ ] Supabase: migrations 0001–0003, seed de catálogo, administradora criada (docs/SUPABASE.md)
- [ ] Preços reais cadastrados no painel (os do seed são fictícios)
- [ ] Número de WhatsApp em Configurações
- [ ] `APP_MODE=production` na API (ela se recusa a iniciar com banco em memória ou login mock)
- [ ] `CORS_ORIGIN` = domínio do site (ex.: `https://karollapet.com.br`)
- [ ] Opcional: `GOOGLE_SHEETS_WEBHOOK` e `WHATSAPP_PROVIDER=cloud_api`

## Netlify (configurado)

O repositório já tem `netlify.toml`: o site sai de `frontend/dist` e a API roda como
Netlify Function (`netlify/functions/api.mts`, o mesmo app Express de `backend/`), com `/api/*` → função.
Projeto: `cool-hotteok-c96ed7` — cada push na branch publica automaticamente.

Variáveis em *Site configuration → Environment variables* (escopo **Functions**):

| Fase | Variáveis |
|---|---|
| Pré-visualização (DEMO) | `APP_MODE=demo`, `DEMO_ADMIN_EMAIL`, `DEMO_ADMIN_PASSWORD`, `AUTH_TOKEN_SECRET`, `CORS_ORIGIN` |
| Produção (Supabase) | `APP_MODE=production`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (secreta), `WHATSAPP_NUMBER`, `CORS_ORIGIN` |

⚠️ No modo DEMO o banco é em memória **por instância da função**: agendamentos podem não aparecer no
painel e somem quando a função reinicia. Serve só para ver o site e testar o fluxo — use Supabase para valer.

## API (Node)
Qualquer host Node 20+ (Render, Railway, Fly.io, VPS):

```bash
npm ci
npm run build -w backend
node backend/dist/server.js      # porta em $PORT
```

Health check: `GET /api/health`. O rate limit é em memória: com várias instâncias, use o limitador da plataforma.

## Site (estático)
```bash
npm ci
npm run build -w frontend         # gera frontend/dist
```

Publique `frontend/dist` com:
1. **Fallback SPA**: qualquer rota → `index.html`.
2. **API**: encaminhe `/api/*` para a API (rewrite/proxy) **ou** faça o build com `VITE_API_URL=https://api.seudominio`.

Exemplo Vercel (`frontend/vercel.json`):
```json
{
  "rewrites": [
    { "source": "/api/(.*)", "destination": "https://SUA-API/api/$1" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```
Exemplo Netlify (`frontend/public/_redirects`):
```
/api/*  https://SUA-API/api/:splat  200
/*      /index.html                 200
```

## Performance
Home leve (agendamento e painel carregados sob demanda), fontes self-hosted, ilustrações em SVG,
`loading="lazy"` em fotos da galeria, chunks separados para React e formulários.
