# Domínio karollapet.com.br (Registro.br + Netlify)

O site já está preparado para **https://karollapet.com.br**: endereço oficial nas buscas (canonical),
no compartilhamento (Open Graph), em `sitemap.xml` e `robots.txt`. Falta só registrar e apontar o domínio.

> Para usar outro domínio, troque `VITE_SITE_URL` em `netlify.toml` e publique de novo.

## 1. Registrar no Registro.br
1. Acesse <https://registro.br>, pesquise `karollapet.com.br` e siga o registro
   (precisa de **CPF ou CNPJ** do titular; o pagamento é anual).
2. Use o e-mail e os dados da empresa/titular verdadeiros — eles valem para recuperar o domínio.

## 2. Apontar para o Netlify (escolha **um** caminho)

Antes, no Netlify: *Projeto `cool-hotteok-c96ed7` → Domain management → Add a domain* → `karollapet.com.br`
(o Netlify oferece incluir `www.karollapet.com.br` também — aceite).

### Caminho A — DNS do Netlify (mais simples, recomendado)
1. No Netlify, em *Domain management*, escolha **Set up Netlify DNS**. Ele mostra 4 servidores
   (algo como `dns1.p0X.nsone.net` … `dns4.p0X.nsone.net`).
2. No Registro.br: *Painel → Domínios → karollapet.com.br → DNS → Alterar servidores DNS*,
   cole os 4 servidores e salve.
3. Pronto: o Netlify cria os registros sozinho. E-mails ou verificações (Google, Meta) passam a ser
   adicionados no DNS do Netlify.

### Caminho B — manter o DNS do Registro.br
No Registro.br: *DNS → Editar zona* (modo avançado) e crie:

| Tipo | Nome | Valor |
|---|---|---|
| A | (vazio / `karollapet.com.br`) | `75.2.60.5` |
| CNAME | `www` | `cool-hotteok-c96ed7.netlify.app` |

(`75.2.60.5` é o endereço do balanceador do Netlify para domínio raiz — confira na
[documentação do Netlify](https://docs.netlify.com/domains-https/custom-domains/configure-external-dns/) no dia.)

A propagação leva de minutos até 48 h.

## 3. Depois que o domínio responder
1. **HTTPS**: em *Domain management → HTTPS*, o certificado (Let's Encrypt) é emitido automaticamente.
2. **Domínio principal**: deixe `karollapet.com.br` como *Primary domain* — o Netlify redireciona
   `www` e o endereço `.netlify.app` para ele.
3. **Abrir para o público**: *Project configuration → Access & security → Visitor access* → desative a
   exigência de login da equipe Netlify (hoje o site só abre para quem está logado no Netlify).
4. **CORS** (opcional, a API é no mesmo endereço): em *Environment variables*, `CORS_ORIGIN` =
   `https://karollapet.com.br,https://www.karollapet.com.br`.
5. **Google Search Console**: adicione a propriedade de domínio `karollapet.com.br`, verifique com o
   registro TXT que o Google mostrar (no DNS escolhido acima) e envie `https://karollapet.com.br/sitemap.xml`.
6. **Meta (anúncios)**: *Configurações do negócio → Segurança da marca → Domínios* → adicione o domínio
   e verifique pelo registro TXT (recomendado pela Meta para medir conversões). Veja `docs/ANUNCIOS.md`.

## O que já está configurado no projeto
- `netlify.toml`: `VITE_SITE_URL`, cabeçalhos de segurança (HSTS, nosniff, anti-iframe, referrer).
- `sitemap.xml` e `robots.txt` gerados no build (o painel `/admin` e a API ficam fora das buscas).
- Dados estruturados (PetStore) com nome, telefone, endereço, horários e Instagram vindos do painel.
