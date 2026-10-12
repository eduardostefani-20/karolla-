import { useState } from 'react';
import { MessageCircle } from 'lucide-react';
import type { ContactKind, ContactLog } from '@karolla/shared';
import { adminApi } from '@/services/adminApi';
import { friendlyMessage } from '@/services/api';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';

/**
 * Contato pelo WhatsApp SEM envio automático: abre a conversa com a mensagem pronta, registra a
 * tentativa e pergunta se a pessoa enviou de fato.
 */
export function ContactButton({
  customerId,
  kind = 'reactivation',
  appointmentId = null,
  label = 'Chamar no WhatsApp',
  disabled,
  disabledReason,
  size = 'sm',
  onDone,
  start: startOverride,
}: {
  customerId: string;
  kind?: ContactKind;
  appointmentId?: string | null;
  label?: string;
  disabled?: boolean;
  disabledReason?: string;
  size?: 'sm' | 'md';
  onDone?: (contact: ContactLog) => void;
  /** Outra forma de abrir o contato (ex.: aviso de retirada a partir do agendamento). */
  start?: () => Promise<{ contact: ContactLog; whatsappLink: string }>;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<{ contact: ContactLog; link: string } | null>(null);

  const start = async () => {
    // abre a aba já no clique (evita bloqueio de pop-up) e depois aponta para a conversa
    const tab = window.open('about:blank', '_blank');
    setBusy(true);
    try {
      const { contact, whatsappLink } = startOverride ? await startOverride() : await adminApi.startContact(customerId, { kind, appointmentId });
      if (tab) {
        tab.opener = null;
        tab.location.href = whatsappLink;
      }
      setPending({ contact, link: whatsappLink });
    } catch (err) {
      tab?.close();
      toast(friendlyMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const confirm = async (status: 'sent' | 'cancelled') => {
    if (!pending) return;
    try {
      const updated = await adminApi.updateContact(pending.contact.id, status);
      toast(status === 'sent' ? 'Contato registrado como enviado.' : 'Registrado como não enviado.');
      onDone?.(updated);
    } catch (err) {
      toast(friendlyMessage(err), 'error');
    } finally {
      setPending(null);
    }
  };

  return (
    <>
      <Button
        variant="whatsapp"
        size={size}
        onClick={start}
        loading={busy}
        disabled={disabled}
        title={disabled ? disabledReason : undefined}
        icon={<MessageCircle className="h-4 w-4" aria-hidden />}
      >
        {label}
      </Button>
      {pending && (
        <Modal
          open
          onClose={() => {
            onDone?.(pending.contact);
            setPending(null);
          }}
          title="A mensagem foi enviada?"
          footer={
            <>
              <Button variant="ghost" onClick={() => confirm('cancelled')}>Não enviei</Button>
              <Button variant="primary" onClick={() => confirm('sent')}>Sim, enviei</Button>
            </>
          }
        >
          <p className="text-sm text-ink-600">O WhatsApp foi aberto com a mensagem abaixo. Nada é enviado automaticamente — confirme aqui depois de enviar.</p>
          <p className="mt-3 whitespace-pre-wrap rounded-2xl bg-lilac-50 p-3 text-sm text-ink-800">{pending.contact.message}</p>
          <a href={pending.link} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-sm font-semibold text-brand-700 underline">
            Abrir o WhatsApp de novo
          </a>
        </Modal>
      )}
    </>
  );
}
