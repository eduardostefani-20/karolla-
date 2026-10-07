import { ArrowRight, Bath, Clock, Scissors, Sparkles, Wind } from 'lucide-react';
import { formatCents, getStartingPrice, type Service } from '@karolla/shared';
import { useCatalog } from '@/context/CatalogContext';
import { ButtonLink } from '@/components/ui/Button';
import { Alert, Spinner } from '@/components/ui/Feedback';
import { Section } from './Section';

const iconFor = (s: Service) => {
  const n = `${s.category} ${s.name}`.toLowerCase();
  if (n.includes('combo') || (n.includes('banho') && n.includes('tosa'))) return Sparkles;
  if (n.includes('tosa')) return Scissors;
  if (n.includes('escova')) return Wind;
  return Bath;
};

export function ServicesSection() {
  const { catalog, loading, error, reload } = useCatalog();
  return (
    <Section id="servicos" eyebrow="Serviços" title="Tudo para seu pet ficar lindo" intro="Os valores variam conforme o porte. Você vê o preço exato antes de confirmar.">
      {loading && <Spinner label="Carregando serviços..." />}
      {error && (
        <Alert tone="error" title="Não conseguimos carregar os serviços" action={<button className="font-semibold underline" onClick={() => reload()}>Tentar novamente</button>}>
          {error}
        </Alert>
      )}
      {catalog && (
        <>
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {catalog.services.map((service, i) => {
              const Icon = iconFor(service);
              const from = getStartingPrice(service.id, catalog);
              return (
                <li key={service.id} className="card group flex flex-col p-6 transition-transform hover:-translate-y-1" style={{ animationDelay: `${i * 60}ms` }}>
                  <div className="mb-4 flex items-center justify-between">
                    <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand-600 transition-colors group-hover:bg-brand-600 group-hover:text-white">
                      <Icon className="h-6 w-6" aria-hidden />
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-ink-400">
                      <Clock className="h-3.5 w-3.5" aria-hidden /> ~{service.durationMinutes} min
                    </span>
                  </div>
                  <h3 className="text-xl font-semibold">{service.name}</h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-500">{service.description}</p>
                  {from != null && (
                    <p className="mt-4 text-sm text-ink-500">
                      a partir de <strong className="font-display text-xl text-brand-700">{formatCents(from)}</strong>
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="mt-10 text-center">
            <ButtonLink to="/agendar" size="lg" icon={<ArrowRight className="h-5 w-5" aria-hidden />}>
              Escolher serviço e agendar
            </ButtonLink>
          </div>
        </>
      )}
    </Section>
  );
}
