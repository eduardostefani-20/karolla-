import { CalendarHeart, Check } from 'lucide-react';
import { ButtonLink } from '@/components/ui/Button';
import { siteContent } from '@/data/content';
import { HeroArt } from './HeroArt';

export function Hero() {
  const { hero, about } = siteContent;
  return (
    <section className="relative overflow-hidden pb-12 pt-6 sm:pb-20 sm:pt-10" aria-labelledby="hero-titulo">
      <div className="pointer-events-none absolute -left-32 top-24 h-72 w-72 rounded-full bg-coral-100 blur-3xl" aria-hidden />
      <div className="container-page grid items-center gap-10 lg:grid-cols-2">
        <div className="relative animate-fade-up text-center lg:text-left">
          <span className="eyebrow">{hero.eyebrow}</span>
          <h1 id="hero-titulo" className="mt-5 text-[2.6rem] font-semibold leading-[1.05] sm:text-6xl">
            {hero.title.split(',')[0]},{' '}
            <span className="relative whitespace-nowrap text-brand-600">
              {hero.title.split(',').slice(1).join(',').trim()}
              <svg viewBox="0 0 200 12" className="absolute -bottom-2 left-0 h-3 w-full text-coral-400" aria-hidden preserveAspectRatio="none">
                <path d="M2 9 Q100 -2 198 8" stroke="currentColor" strokeWidth="4" fill="none" strokeLinecap="round" />
              </svg>
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg text-ink-500 lg:mx-0">{hero.subtitle}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center lg:justify-start">
            <ButtonLink to="/agendar" size="lg" icon={<CalendarHeart className="h-5 w-5" aria-hidden />}>
              Agendar agora
            </ButtonLink>
            <ButtonLink to="/#servicos" size="lg" variant="outline">
              Ver serviços e preços
            </ButtonLink>
          </div>
          <ul className="mt-8 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm font-medium text-ink-600 lg:justify-start">
            {about.highlights.map((h) => (
              <li key={h} className="inline-flex items-center gap-1.5">
                <Check className="h-4 w-4 text-brand-500" aria-hidden /> {h}
              </li>
            ))}
          </ul>
        </div>
        <HeroArt />
      </div>
    </section>
  );
}
