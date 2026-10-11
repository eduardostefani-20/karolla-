import type { ReactNode } from 'react';
import { CalendarHeart, Check } from 'lucide-react';
import { ButtonLink } from '@/components/ui/Button';
import { Blob, TitleWave, WaveDivider } from '@/components/brand/BrandShapes';
import { HeartIcon, SparkleIcon } from '@/components/brand/BrandIcons';
import { siteContent } from '@/data/content';
import { HeroArt } from './HeroArt';

/** Hero com o fundo "sunburst" da marca (raios roxo/lilás), formas orgânicas e onda divisória. */
export function Hero({ top }: { top?: ReactNode }) {
  const { hero, about } = siteContent;
  const [first, ...rest] = hero.title.split(',');
  return (
    <section className="sunburst relative overflow-hidden text-white" aria-labelledby="hero-titulo">
      {/* formas orgânicas nos cantos (amarelo e verde) */}
      <Blob tone="accent" className="absolute -right-24 -top-24 hidden h-72 w-72 opacity-90 lg:block" />
      <Blob tone="leaf" className="absolute -bottom-12 -left-16 h-40 w-40 rotate-45 opacity-90" />
      <Blob tone="accent" className="absolute -bottom-14 -right-14 h-36 w-36 opacity-90 lg:hidden" />
      <SparkleIcon className="absolute right-[8%] top-10 hidden h-8 w-8 text-accent sm:block" />
      <HeartIcon className="absolute left-[46%] top-16 hidden h-6 w-6 rotate-12 text-leaf-300 lg:block" />

      <div className="container-page relative pt-5">{top}</div>
      <div className="container-page relative grid items-center gap-10 pb-16 pt-6 sm:pb-24 sm:pt-8 lg:grid-cols-2">
        <div className="relative animate-fade-up text-center lg:text-left">
          <span className="eyebrow">{hero.eyebrow}</span>
          <h1 id="hero-titulo" className="title-display mt-5 text-display-hero text-white">
            {first},{' '}
            <span className="relative inline-block whitespace-nowrap text-accent">
              {rest.join(',').trim()}
              <TitleWave className="absolute -bottom-3 left-[-4%] h-4 w-[108%] sm:-bottom-4 sm:h-5" />
            </span>
          </h1>
          <p className="mx-auto mt-8 max-w-xl text-lg text-brand-50 lg:mx-0">{hero.subtitle}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center lg:justify-start">
            <ButtonLink to="/agendar" size="lg" variant="accent" icon={<CalendarHeart className="h-5 w-5" aria-hidden />}>
              Agendar agora
            </ButtonLink>
            <ButtonLink to="/#servicos" size="lg" variant="onDark">
              Ver serviços e preços
            </ButtonLink>
          </div>
          <ul className="mt-8 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm font-semibold text-white lg:justify-start">
            {about.highlights.map((h) => (
              <li key={h} className="inline-flex items-center gap-1.5">
                <Check className="h-4 w-4 text-accent" strokeWidth={3} aria-hidden /> {h}
              </li>
            ))}
          </ul>
        </div>
        <HeroArt />
      </div>
      <WaveDivider fill="fill-white" className="relative" />
    </section>
  );
}
