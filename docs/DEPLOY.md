# Deploy

## Checklist
- [ ] Supabase: migrations 0001–0003, seed de catálogo, administradora criada (docs/SUPABASE.md)
- [ ] Preços reais cadastrados no painel (os do seed são fictícios)
- [ ] Número de WhatsApp em Configurações
- [ ] `APP_MODE=production` na API (ela se recusa a iniciar com banco em memória ou login mock)
- [ ] `CORS_ORIGIN` = domínio do site (ex.: `https://karollapet.com.br`)
- [ ] Opcional: `GOOGLE_SHEETS_WEBHOOK` e `WHATSAPP_PROVIDER=cloud_api`

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
