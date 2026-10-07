# Conteúdo do site e fotos

- Textos institucionais (hero, sobre, como funciona, diferenciais, FAQ, galeria): `frontend/src/data/content.ts`.
- Serviços, preços, horários e contatos **não** ficam no código — vêm do painel.
- As imagens atuais são ilustrações vetoriais próprias. Para usar **fotos reais** da Karolla Pet:
  1. Coloque os arquivos (ideal: `.webp`, ~1000px no maior lado) em `frontend/public/images/galeria/`.
  2. Em `content.ts`, preencha `photo: '/images/galeria/arquivo.webp'` no item da galeria — a legenda vira o `alt`.
- Não inclua serviços veterinários (consulta, vacina, diagnóstico, cirurgia): a Karolla Pet é pet shop.
- Imagem de compartilhamento: `frontend/public/og-image.png` (1200×630).
