# Conteúdo do site e fotos

- Textos institucionais (hero, sobre, como funciona, diferenciais, FAQ, galeria): `frontend/src/data/content.ts`.
- Serviços, preços, horários e contatos **não** ficam no código — vêm do painel.
- As imagens atuais são ilustrações vetoriais próprias. Para usar **fotos reais** da Karolla Pet:
  1. Coloque os arquivos (ideal: `.webp`, ~1000px no maior lado) em `frontend/public/images/galeria/`.
  2. Em `content.ts`, preencha `photo: '/images/galeria/arquivo.webp'` no item da galeria — a legenda vira o `alt`.
- Não inclua serviços veterinários (consulta, vacina, diagnóstico, cirurgia): a Karolla Pet é pet shop.
- Imagem de compartilhamento: `frontend/public/og-image.jpg` (1200×630, logo sobre o sunburst roxo).

## Identidade visual KarollaPet
- **Logo**: `frontend/public/brand/karollapet-logo-480.webp`, `-960.webp` e `-960.png` (fundo transparente);
  ícone da patinha em `brand/karollapet-icone-256.*`; favicons (`favicon.ico`, `favicon-16x16.png`,
  `favicon-32x32.png`) e `apple-touch-icon.png` (180×180) na raiz de `public/`. Use sempre o componente `<Logo />`.
- **Cores, fontes, raios e sombras**: só em `frontend/src/styles/theme.css` (fonte única). Nos componentes use as
  classes do Tailwind ligadas a esses tokens (`bg-primary`, `text-primary-dark`, `bg-accent`, `text-leaf-700`…) —
  nunca hex solto.

| Token | Cor | Uso |
|---|---|---|
| `--color-primary` | `#6A1FA0` | base da marca, botão principal, cabeçalho |
| `--color-primary-dark` | `#3D0E63` | rodapé, hover, sombras |
| `--color-primary-light` | `#9B5FD0` | raios do sunburst, foco, destaques |
| `--color-secondary` | `#8A9A1C` | ícones de apoio, tags (texto verde: `leaf-700`) |
| `--color-accent` | `#F9B21D` | preços, selos, CTA de destaque (texto roxo profundo, nunca branco) |
| `--color-text` | `#2A0A45` | texto |
| `--color-bg-soft` | `#F6F0FB` | fundo do site |

- **Fontes**: Pacifico (`font-display` / classe `.title-display`) só em títulos grandes (hero, seções, páginas);
  Nunito para todo o resto. Arquivos servidos pelo próprio site (pacotes `@fontsource`), sem chamada ao Google.
- **Elementos gráficos**: fundo `.sunburst`, ondas (`WaveDivider`), formas orgânicas (`Blob`), onda sob o título
  (`TitleWave`) em `components/brand/BrandShapes.tsx`; ícones da marca (patinha com almofada de coração, coração,
  brilho, frasco de shampoo) em `components/brand/BrandIcons.tsx`.
- **Classes prontas**: `.card` / `.card-hover`, `.price-badge` (preço/promo), `.tag` e `.eyebrow` (verde), `.link`.
- **Proibido**: rosa forte e azul forte.
