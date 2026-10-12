# Área do cliente ("Minha conta") e CRM

## Minha conta (site → "Entrar")

O tutor cria uma conta com nome, e-mail, WhatsApp e senha (aceitando a política de privacidade).

**Como a conta é ligada ao cadastro da Karolla Pet** (é isso que decide o que a pessoa vê):

| Situação | O que acontece |
|---|---|
| O e-mail confirmado é o mesmo de um cadastro existente (dos agendamentos) | Liga sozinho: a pessoa vê os pets e o histórico desse cadastro. |
| Não existe cadastro com esse e-mail e o WhatsApp ainda não está em uso | Cria um cadastro novo, já ligado à conta. |
| O WhatsApp já pertence a outro cadastro (com outro e-mail) | **Não liga sozinho** (WhatsApp não é verificado). A conta fica "pendente" e a equipe confirma em Painel → Cliente → "Conta no site" → Ligar conta. |

Na conta, o cliente:
- edita nome, WhatsApp, endereço e a opção "não quero receber lembretes/promoções";
- troca o e-mail (só vale depois de confirmar pelo link enviado ao novo endereço);
- cadastra e edita pets: espécie, raça, porte, peso, data de nascimento (a idade é calculada),
  características/temperamento, preferências de tosa e observações;
- envia a **foto do pet** e **fotos de referência** de corte, com descrição;
- vê o histórico e os próximos agendamentos.

**Privacidade**
- Cada cliente só acessa o próprio cadastro. Trocar o número/id na URL devolve "não encontrado" (testado).
- **Observações internas** da equipe (do cliente e do pet) nunca são enviadas ao cliente.
- Fotos ficam no bucket **privado** `karolla-private` (sem endereço público). Elas abrem por links que
  expiram em 10 minutos, gerados só para o dono e para a equipe. Só JPG/PNG/WebP até 8 MB.
- O login do cliente não abre o painel da equipe (e vice-versa).

## Painel

- **CRM** (menu CRM): clientes *novos* (0–1 atendimento concluído), *recorrentes* (2+) e *inativos*
  (último atendimento **concluído** há mais de N dias e nenhum horário marcado). N é configurável em
  Configurações → CRM (padrão 40).
- **Contato pelo WhatsApp sem envio automático**: "Convidar a voltar"/"Chamar no WhatsApp" abre a conversa
  com a mensagem pronta (modelo em Configurações, com {tutor}, {pet}, {dias}), registra a tentativa e
  pergunta se a pessoa enviou ("Sim, enviei" / "Não enviei"). Fica no histórico do cliente.
- Clientes que pediram para não receber mensagens **não recebem convite de reativação** (o botão fica bloqueado
  e o servidor recusa).
- **Ficha do cliente**: observações internas, preferência de mensagens, conta do site (ligar/desfazer) e
  histórico de contatos.
- **Ficha do pet**: data de nascimento, características, preferências de tosa, observações internas
  (destacadas, só a equipe vê), foto e fotos de referência (a equipe também pode enviar).

Permissões: CRM exige "CRM → Ver" + "Clientes → Ver"; chamar no WhatsApp exige "CRM → Editar".

## Configuração necessária no Supabase

1. **Authentication → Sign In / Providers → Email → "Confirm email" LIGADO** (padrão do Supabase).
   É a confirmação do e-mail que permite ligar a conta ao cadastro com segurança. Se estiver desligado,
   o sistema não liga nenhuma conta automaticamente (todas ficam pendentes para a equipe confirmar).
2. **Authentication → URL Configuration → Redirect URLs**: incluir
   `https://karollapet.com.br/minha-conta/entrar`, `https://karollapet.com.br/minha-conta` e
   `https://karollapet.com.br/redefinir-senha` (e os equivalentes em `karollapet.netlify.app`, se usar).
3. **SMTP próprio** (Authentication → SMTP): o e-mail padrão do Supabase envia poucas mensagens por hora.
4. Migração `database/migrations/0009_portal_cliente_pets_crm.sql` aplicada (cria o bucket privado).
