# Equipe e acessos (contas individuais e permissões)

Cada pessoa da equipe entra no painel com **o próprio e-mail e senha**. A conta principal (Karol) cria,
altera, desativa e reativa as outras contas em **Painel → Equipe e acessos**.

## Perfis

| Perfil | O que pode fazer (padrão) |
|---|---|
| Administradora principal | Tudo, sempre. Não pode ser desativada nem ter permissões reduzidas. |
| Administrador | Tudo (inclusive valores e equipe). |
| Gerente | Agenda, clientes, pets, CRM, conteúdo (inspirações/stories), comentários, Taxi Dog. **Sem valores** e **sem gerenciar a equipe**. |
| Freelance | Só os **próprios atendimentos** e os pets deles. Sem valores e sem contato dos tutores. |
| Profissional | Os próprios atendimentos + mudar o status deles. Sem valores e sem contato dos tutores. |

"Personalizar permissões" libera ou bloqueia, para aquela pessoa, cada ação (ver, criar, editar,
excluir, confirmar, administrar) em cada área, além de escolher **agenda completa** ou **somente os
próprios atendimentos** (é preciso vincular a conta a um profissional).

## Como a segurança funciona

- **Tudo é conferido no servidor**, em cada requisição. Esconder menus na tela é só conveniência:
  digitar a URL de outra área ou de um atendimento de outra pessoa devolve "sem acesso"/"não encontrado".
- **Valores financeiros** (preços, totais, receitas, mensalidades) são **removidos pelo servidor** antes
  de a resposta sair para quem não tem "Valores e financeiro → Ver" — não chegam ao navegador.
  *Os preços da página pública do site continuam públicos, como sempre foram.*
- **Contato e endereço dos tutores** só saem para quem tem "Clientes → Ver".
- Ninguém concede a outra pessoa uma permissão que não tem; ninguém altera o próprio perfil.
- **Desativar** uma conta corta o acesso na hora (mesmo com a sessão aberta). O histórico é mantido.
- O banco de dados (Supabase) também bloqueia a leitura direta das tabelas por contas que não têm
  acesso total (migração `0008`), para que ninguém contorne as permissões pela API do Supabase.
- **Senhas**: guardadas com hash pelo Supabase Auth (nunca pelo nosso servidor). Mínimo de 8
  caracteres com letras e números. Trocar a senha encerra as outras sessões.
- **Sessão**: o acesso vence em ~1 hora e é renovado automaticamente enquanto a pessoa usa o painel;
  "Sair" encerra a sessão.
- **Registro de ações (auditoria)**: cada criação, alteração ou exclusão no painel (e cada login)
  fica registrada com quem fez, quando, a área, o id do registro e o resultado. **O conteúdo enviado
  não é gravado** (nada de senhas ou dados pessoais no registro). Veja em Equipe e acessos → Registro de ações.

## Recuperação de senha

- No login, "Esqueci minha senha" envia um link por e-mail (a resposta é sempre a mesma, para não
  revelar quais e-mails têm conta). O link abre `/redefinir-senha`, vale por pouco tempo e uma vez só.
- A administradora pode, em Equipe e acessos, **definir uma senha** para alguém ou **enviar o link**.

### Configuração necessária no Supabase (uma vez)

1. **Authentication → URL Configuration → Redirect URLs**: adicionar
   `https://karollapet.com.br/redefinir-senha` (e o endereço do Netlify, se ainda usar,
   ex.: `https://karolllapet.netlify.app/redefinir-senha`).
2. **Authentication → SMTP**: o e-mail padrão do Supabase envia poucas mensagens por hora e serve só
   para testes. Para uso real, configure um SMTP próprio (ex.: o e-mail do domínio).
3. A variável `PUBLIC_SITE_URL` do servidor (Netlify) precisa apontar para o endereço do site — é
   ela que monta o link de redefinição.
