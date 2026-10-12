import { Home, MessageCircle, PartyPopper } from 'lucide-react';
import { buildWhatsAppLink, formatCents, formatDateBR } from '@karolla/shared';
import { useCatalog } from '@/context/CatalogContext';
import { useBooking } from '@/context/BookingContext';
import { ButtonLink, ExternalButton } from '@/components/ui/Button';
import { StepHeader } from './StepHeader';

export function ConfirmationStep() {
  const { catalog } = useCatalog();
  const { draft, reset } = useBooking();
  const result = draft.result;
  if (!result) return null;
  const a = result.appointment;
  const whatsapp = result.whatsappLink || (catalog?.settings.whatsappNumber ? buildWhatsAppLink(catalog.settings.whatsappNumber) : '');

  return (
    <div className="text-center">
      <StepHeader step={9} title="" />
      <div className="mx-auto grid h-20 w-20 animate-pop place-items-center rounded-full bg-leaf-100 text-leaf-600">
        <PartyPopper className="h-10 w-10" aria-hidden />
      </div>
      <h2 className="title-display mt-5 text-display-page text-primary" data-testid="confirmation-title">
        🎉 Agendamento recebido!
      </h2>
      <p className="mx-auto mt-2 max-w-md text-ink-500">O agendamento do seu pet foi registrado.</p>

      <dl className="card mx-auto mt-6 grid max-w-md grid-cols-2 gap-4 p-6 text-left">
        <div>
          <dt className="text-xs font-bold uppercase text-ink-400">Pet</dt>
          <dd className="font-semibold">{result.pet.name}</dd>
        </div>
        <div>
          <dt className="text-xs font-bold uppercase text-ink-400">Serviço</dt>
          <dd className="font-semibold">{a.services.map((s) => s.name).join(' + ')}</dd>
        </div>
        <div>
          <dt className="text-xs font-bold uppercase text-ink-400">Data</dt>
          <dd className="font-semibold">{formatDateBR(a.date)}</dd>
        </div>
        <div>
          <dt className="text-xs font-bold uppercase text-ink-400">Horário</dt>
          <dd className="font-semibold">{a.time}</dd>
        </div>
        <div className="col-span-2 border-t border-dashed border-ink-900/10 pt-4">
          <dt className="text-xs font-bold uppercase text-ink-400">Total</dt>
          <dd><span className="price-badge px-4 py-1 text-2xl">{formatCents(a.totalCents)}</span></dd>
        </div>
        {a.professionalId && (
          <div className="col-span-2">
            <dt className="text-xs font-bold uppercase text-ink-400">Profissional</dt>
            <dd className="font-semibold">{catalog?.professionals.find((p) => p.id === a.professionalId)?.name ?? 'Definido pela equipe'}</dd>
          </div>
        )}
        {a.inspiration && (
          <div className="col-span-2 flex items-center gap-3 rounded-2xl bg-sun-50 p-2.5">
            <img src={a.inspiration.imageUrl} alt={a.inspiration.title} className="h-14 w-14 rounded-xl object-cover" />
            <div>
              <dt className="text-xs font-bold uppercase text-sun-700">Inspiração enviada</dt>
              <dd className="font-semibold">{a.inspiration.title}</dd>
            </div>
          </div>
        )}
        {result.taxi && (
          <div className="col-span-2 rounded-2xl bg-lilac-50 p-2.5 text-sm">
            <dt className="text-xs font-bold uppercase text-brand-700">Taxi Dog solicitado</dt>
            <dd>
              {result.taxi.pickupTime && `Busca por volta das ${result.taxi.pickupTime}. `}
              {result.taxi.dropoffTime && `Entrega por volta das ${result.taxi.dropoffTime}. `}
              Taxa {formatCents(result.taxi.feeCents)} (à parte). A equipe confirma o motorista.
            </dd>
          </div>
        )}
        <div className="col-span-2 text-xs text-ink-400">Código: {a.id.slice(0, 8).toUpperCase()}</div>
      </dl>

      <p className="mx-auto mt-6 max-w-md rounded-2xl bg-brand-100 px-4 py-3 text-brand-900">
        A Karolla Pet entrará em contato pelo WhatsApp para confirmar o atendimento.
      </p>

      <div className="mx-auto mt-6 flex max-w-md flex-col gap-3">
        {whatsapp && (
          <ExternalButton href={whatsapp} variant="whatsapp" size="lg" block icon={<MessageCircle className="h-5 w-5" aria-hidden />}>
            Falar no WhatsApp
          </ExternalButton>
        )}
        <ButtonLink to="/" variant="outline" size="lg" block onClick={reset} icon={<Home className="h-5 w-5" aria-hidden />}>
          Voltar para o início
        </ButtonLink>
      </div>
    </div>
  );
}
