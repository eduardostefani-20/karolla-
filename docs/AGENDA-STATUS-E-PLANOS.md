# Agenda por profissional, status do atendimento, agendamento manual e planos

## Agenda

- **Intervalo entre horários** (Configurações): define de quanto em quanto tempo os horários aparecem,
  independente da duração do serviço.
- **Capacidade**:
  - sem profissionais cadastrados: "Vagas por horário" (Configurações);
  - com profissionais: soma da capacidade dos profissionais **ativos e disponíveis** naquele horário
    (cada um atende, por padrão, 1 pet por vez — ajustável por profissional);
  - **limite geral opcional por horário** (Configurações), que vale mesmo com vários profissionais;
  - **limite opcional por serviço** (Serviços → editar), ex.: 1 se só há uma mesa de tosa.
- **Horário próprio do profissional** (Profissionais → editar → "Horário diferente do funcionamento"):
  dias desmarcados são folga; intervalo próprio opcional.
- **Folgas, férias e indisponibilidades** (Profissionais → ícone de calendário): dia inteiro ou só um período.
- Desativar um profissional tira ele dos horários futuros; o histórico continua.
- Conflitos são barrados no servidor no momento de gravar (trava atômica no banco), inclusive quando
  duas pessoas agendam o mesmo horário ao mesmo tempo. O limite por serviço é conferido pelo servidor
  na hora do agendamento.

## Status do atendimento

Pendente → **Agendado** → **Aguardando atendimento** → Em atendimento → **Finalizado** →
**Pronto para retirada** → **Entregue ao tutor** (ou Cancelado / Não compareceu).

"Finalizado", "Pronto para retirada" e "Entregue ao tutor" contam como visita no CRM.

**Avisar tutor pelo WhatsApp** (detalhe do agendamento): abre a conversa com a mensagem de retirada
pronta (Configurações → CRM → "Mensagem Pronto para retirada", com {tutor} e {pet}), registra a
tentativa e pergunta se foi enviada. Nada é enviado automaticamente. Exige "Agenda → Confirmar" e
"Clientes → Ver".

## Novo agendamento pelo painel

Agenda ou Agendamentos → **Novo agendamento**: buscar ou cadastrar tutor (WhatsApp já cadastrado
reaproveita o cadastro), escolher ou cadastrar pet, serviços, adicionais, data, horário (com sugestões
de horários livres), profissional, status inicial, **origem** (Site, WhatsApp, Telefone, Presencial,
Outro) e observações. Usa a mesma agenda do site (sem exigir antecedência mínima). Registra quem criou.

## Planos e mensalidades (sem pagamento online)

- **Planos oferecidos**: nome, descrição, valor, periodicidade (mensal, trimestral, semestral, anual),
  serviços incluídos, usos por período, regras, ativo/inativo. Plano já contratado não é excluído (desative).
- **Contratar** (ficha do cliente → Planos): opcionalmente para um pet; começa **Pendente**.
- **Registrar pagamento recebido** (só quem tem "Planos → Confirmar"): valor, data e forma. O plano fica
  **Ativo** e o vencimento passa para o próximo período. **Nada é marcado como pago automaticamente.**
- **Vencido** é calculado: plano ativo cujo vencimento chegou sem pagamento registrado.
- **Pausar / Reativar / Cancelar** ficam no histórico.
- **Uso no atendimento** (detalhe do agendamento → "Usar para ..."): só se o plano estiver ativo, o
  serviço estiver incluído, ainda houver usos no período e o mesmo serviço daquele atendimento não tiver
  sido descontado antes (garantido também no banco). Dá para desfazer.
- Valores dos planos e pagamentos só aparecem para quem tem "Valores e financeiro → Ver".
- O cliente vê os próprios planos (situação, usos e vencimento) em "Minha conta".
- O plano não é aplicado sozinho em agendamentos do site: a equipe aplica no atendimento.

## Banco de dados

Requer a migração `database/migrations/0010_status_agenda_planos.sql` (depois da 0009). Até ela ser
aplicada, esses recursos ficam "em ativação" e o painel mostra um aviso; o restante funciona normalmente.
