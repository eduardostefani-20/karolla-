# Inspirações, estilo de tosa no agendamento e Taxi Dog

> Exigem a migração `database/migrations/0011_inspiracoes_taxi_dog.sql` (depois da 0009 e da 0010).
> Antes dela, o painel mostra o aviso “Atualização do banco pendente”. Até lá, o site esconde o Taxi Dog
> e os comentários, e o resto continua funcionando.

## Inspirações (catálogo no estilo Instagram)

- **Etiquetas** (Painel → Inspirações → editar): espécie, raça, **porte** e **tipo de tosa** (bebê,
  higiênica, tesoura, máquina, padrão da raça, criativa, só banho). Os filtros do site só mostram as
  etiquetas que existem em alguma foto.
- **Detalhe da foto**: etiquetas, descrição, “Quero este visual” (leva para o agendamento) e comentários.
- **Comentários**:
  - só clientes com conta (Minha conta) podem comentar;
  - o texto é simples: HTML é removido e links não são aceitos;
  - limites anti-spam: 20 s entre comentários, até 10 por hora, sem repetir o mesmo texto em 24 h;
  - a página mostra só o primeiro nome do autor; contato e ID do cliente nunca são enviados.
- **Moderação** (Painel → Comentários, permissão “Comentários → Ver/Excluir”): lista com cliente e
  foto. **Remover** tira o comentário da página e o guarda como “removido”, para histórico. O cadastro
  do cliente não muda.

## Estilo de tosa no agendamento

- A etapa só aparece quando um serviço escolhido **inclui tosa**. Marque isso em Painel → Serviços →
  editar → “Inclui tosa”. Ao aplicar a migração 0011, os serviços com “tosa” no nome ou na categoria
  já vêm marcados; depois, ajuste como quiser.
- **Sugestões**: só fotos do catálogo de inspirações **da raça do pet**. Nada é inventado. Se a raça
  não tem foto, o site diz isso e oferece descrição ou foto própria.
- **Foto de referência do tutor**:
  - JPG, PNG ou WebP, até 10 MB;
  - vai para o armazenamento **privado** (bucket `karolla-private`) e nunca fica pública;
  - fica ligada ao **pet** e ao **agendamento**;
  - tem uma descrição opcional;
  - o servidor confere se o arquivo realmente chegou antes de aceitar o agendamento.
- **Na equipe**:
  - a agenda e as listas mostram um ícone de tesoura quando há estilo escolhido;
  - o detalhe do agendamento mostra a inspiração escolhida, o texto (“Tosa: …”) e a foto de
    referência, por link temporário de 10 minutos;
  - a foto também fica na ficha do pet.

## Taxi Dog

### Configurar (Painel → Taxi Dog → Configuração)

1. **Regiões e taxas**: nome, bairros atendidos (um por linha; `*` = cidade inteira; acentos e
   maiúsculas não importam) e as taxas “só ida ou só volta” e “ida e volta”. Os valores são definidos
   pela Karolla Pet; o sistema não traz preços prontos.
2. **Motoristas**: vários motoristas. Cada um tem pets por viagem (capacidade), um horário próprio
   opcional e pode ser ativado ou desativado.
3. **Períodos sem Taxi Dog**: o serviço inteiro ou um motorista, por dia inteiro ou por período.
4. **Funcionamento**:
   - dias e horários;
   - quantos minutos antes do atendimento buscar o pet;
   - duração de cada viagem (o tempo que o motorista fica ocupado);
   - **Oferecer Taxi Dog no site**.

### No site

- A opção aparece na etapa do tutor **só quando o Taxi Dog está ligado**.
- O cliente escolhe o trajeto (só ida, só volta, ida e volta). O site confere a disponibilidade **no
  servidor** e mostra a taxa e os horários previstos.
- A opção fica **indisponível** quando:
  - o bairro não é atendido;
  - o horário está fora da janela;
  - há um bloqueio no período;
  - não há motorista trabalhando;
  - a capacidade está cheia.

  Nesses casos o agendamento com Taxi Dog é recusado (e a recusa é conferida de novo ao gravar).

### Na equipe

- **Transportes** (por data) e o painel “Taxi Dog” no detalhe do agendamento.
- O transporte nasce **Solicitado**. Escolher um motorista confirma o transporte, mas só se esse
  motorista estiver **disponível e com capacidade** naquele horário; senão, o servidor recusa.
- O status do transporte é **independente** do status do atendimento: Solicitado → Confirmado → A
  caminho do tutor → Pet buscado → Na Karolla Pet → Saiu para entrega → Entregue (ou Cancelado).
- A taxa segue a permissão financeira: quem não tem “Financeiro → Ver” não recebe valores.

### Acesso de motorista (preparado)

Crie uma conta em Equipe e acessos com permissões personalizadas: só **Taxi Dog → Ver** e
**Taxi Dog → Editar**. Essa pessoa vê apenas o menu Taxi Dog, com endereço, WhatsApp e observações do
transporte, e pode atualizar o status. Valores e o resto do painel ficam escondidos.

Ainda **não** existe a restrição “cada motorista vê só os próprios transportes”. Fica como próximo
passo: ligar a conta ao motorista, como já é feito com o profissional.

## Permissões

| Área        | Ações                                                       |
| ----------- | ----------------------------------------------------------- |
| Comentários | Ver, Excluir                                                |
| Taxi Dog    | Ver, Criar (regiões/motoristas), Editar (configuração e transportes) |

Admin e gerente já vêm com essas permissões. Profissional e freelance só as recebem se forem
concedidas.
