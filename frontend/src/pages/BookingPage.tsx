import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useCatalog } from '@/context/CatalogContext';
import { useBooking } from '@/context/BookingContext';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { Alert, Spinner } from '@/components/ui/Feedback';
import { Button } from '@/components/ui/Button';
import { Logo } from '@/components/site/Logo';
import { DemoBanner } from '@/components/site/DemoBanner';
import { PriceSummary } from '@/components/booking/PriceSummary';
import { SpeciesStep } from '@/components/booking/SpeciesStep';
import { PetStep } from '@/components/booking/PetStep';
import { ServiceStep } from '@/components/booking/ServiceStep';
import { AddonsStep } from '@/components/booking/AddonsStep';
import { DateStep } from '@/components/booking/DateStep';
import { TimeStep } from '@/components/booking/TimeStep';
import { TutorStep } from '@/components/booking/TutorStep';
import { SummaryStep } from '@/components/booking/SummaryStep';
import { ConfirmationStep } from '@/components/booking/ConfirmationStep';
import { firstIncompleteStep, TOTAL_STEPS } from '@/components/booking/steps';
import { InspirationChip } from '@/components/booking/InspirationChip';
import { publicApi } from '@/services/publicApi';
import { trackEvent } from '@/services/tracking';

/**
 * Fluxo de agendamento em 9 etapas. A etapa atual fica na URL (?etapa=N),
 * então o botão "voltar" do navegador funciona e nada do que foi preenchido se perde.
 */
export default function BookingPage() {
  useDocumentMeta({
    title: 'Agendar banho e tosa — Karolla Pet',
    description: 'Agende online o banho, a tosa e os cuidados do seu pet na Karolla Pet. Veja o preço na hora e escolha o melhor horário.',
  });
  const { catalog, loading, error, reload } = useCatalog();
  const { draft, reset, update } = useBooking();
  const [params, setParams] = useSearchParams();
  const [timeNotice, setTimeNotice] = useState<string | null>(null);

  const requested = Math.min(Math.max(Number(params.get('etapa')) || 1, 1), TOTAL_STEPS);
  const confirmed = Boolean(draft.result);
  // nunca deixa pular etapas obrigatórias via URL
  const step = confirmed ? TOTAL_STEPS : Math.min(requested, firstIncompleteStep(draft), TOTAL_STEPS - 1);

  const goTo = useCallback(
    (n: number, replace = false) => {
      setParams({ etapa: String(n) }, { replace });
    },
    [setParams],
  );

  useEffect(() => {
    if (step !== requested) goTo(step, true);
  }, [step, requested, goTo]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    document.getElementById('etapa-titulo')?.focus({ preventScroll: true });
    if (step !== 6) setTimeNotice(null);
  }, [step]);

  // abrir /agendar depois de um agendamento concluído começa um novo;
  // vindo do catálogo (?inspiracao=id), anexa só a referência da foto escolhida.
  useEffect(() => {
    const inspirationId = params.get('inspiracao');
    if (confirmed && (!params.get('etapa') || inspirationId)) reset();
    if (!inspirationId) return;
    publicApi
      .inspiration(inspirationId)
      .then((i) => update({ inspiration: { id: i.id, title: i.title, imageUrl: i.imageUrl, breedName: i.breedName } }))
      .catch(() => undefined) // foto removida/desativada: segue o agendamento normal
      .finally(() => {
        const next = new URLSearchParams(params);
        next.delete('inspiracao');
        setParams(next, { replace: true });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Anúncios: "começou um agendamento" (uma vez por visita)
  useEffect(() => {
    try {
      if (sessionStorage.getItem('karolla:inicio-agendamento')) return;
      sessionStorage.setItem('karolla:inicio-agendamento', '1');
    } catch {
      /* segue sem controle de repetição */
    }
    trackEvent('InitiateCheckout');
  }, []);

  const next = () => goTo(step + 1);
  const back = () => (step > 1 ? goTo(step - 1) : undefined);

  let content: JSX.Element | null = null;
  if (catalog) {
    switch (step) {
      case 1: content = <SpeciesStep onNext={() => goTo(2)} />; break;
      case 2: content = <PetStep onBack={back} onNext={next} />; break;
      case 3: content = <ServiceStep onBack={back} onNext={next} />; break;
      case 4: content = <AddonsStep onBack={back} onNext={next} />; break;
      case 5: content = <DateStep onBack={back} onNext={next} />; break;
      case 6: content = <TimeStep onBack={back} onNext={next} onChangeDate={() => goTo(5)} notice={timeNotice} />; break;
      case 7: content = <TutorStep onBack={back} onNext={next} />; break;
      case 8:
        content = (
          <SummaryStep
            onBack={back}
            goTo={goTo}
            onConfirmed={() => goTo(9, true)}
            onSlotTaken={(message) => {
              setTimeNotice(message);
              goTo(6);
            }}
          />
        );
        break;
      default: content = <ConfirmationStep />;
    }
  }

  const showSummary = step >= 3 && step <= 7;

  return (
    <div className="min-h-dvh bg-cream-100">
      <DemoBanner />
      <header className="border-b border-ink-900/5 bg-white/80 backdrop-blur">
        <div className="container-page flex h-16 items-center justify-between">
          <Link to="/" aria-label="Voltar para o site da Karolla Pet">
            <Logo />
          </Link>
          <Link to="/" className="inline-flex items-center gap-1 text-sm font-semibold text-ink-500 hover:text-ink-800">
            <ArrowLeft className="h-4 w-4" aria-hidden /> Site
          </Link>
        </div>
      </header>
      <main id="conteudo" className="container-page pb-40 pt-6 sm:pt-10 lg:pb-16">
        {loading && <Spinner label="Preparando o agendamento..." />}
        {error && (
          <Alert tone="error" title="Não conseguimos abrir o agendamento" action={<Button size="sm" onClick={() => reload()}>Tentar novamente</Button>}>
            {error}
          </Alert>
        )}
        {catalog && (
          <div className={showSummary ? 'grid gap-8 lg:grid-cols-[1fr_340px]' : 'mx-auto max-w-2xl'}>
            {/* só opacidade: transform criaria um "containing block" e quebraria a barra fixa do celular */}
            <div key={step} className="animate-fade-in">
              {step < TOTAL_STEPS && step !== 8 && <InspirationChip compact={step > 1} />}
              {content}
            </div>
            {showSummary && (
              <div className="hidden lg:block">
                <div className="sticky top-6">
                  <PriceSummary />
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
