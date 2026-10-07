import { HeartHandshake } from 'lucide-react';
import { siteContent } from '@/data/content';
import { PetIllustration } from './PetIllustration';

export function AboutSection() {
  const { about } = siteContent;
  return (
    <section id="sobre" aria-labelledby="sobre-titulo" className="scroll-mt-20 bg-white py-16 sm:py-24">
      <div className="container-page grid items-center gap-12 lg:grid-cols-[1fr_1.1fr]">
        <div className="relative mx-auto w-full max-w-sm">
          <div className="absolute inset-0 rotate-6 rounded-[3rem] bg-coral-100" aria-hidden />
          <div className="relative rounded-[3rem] bg-brand-100 p-8">
            <PetIllustration fur="#fdfaf6" furDark="#e6d7c3" accessory="bow" accent="#ff7d57" title="Cachorrinho com laço após a tosa" />
          </div>
          <div className="absolute -bottom-5 -right-3 flex items-center gap-2 rounded-2xl bg-white px-4 py-3 shadow-soft">
            <HeartHandshake className="h-6 w-6 text-coral-500" aria-hidden />
            <span className="text-sm font-semibold">Feito com carinho</span>
          </div>
        </div>
        <div>
          <span className="eyebrow">Sobre a Karolla Pet</span>
          <h2 id="sobre-titulo" className="mt-4 text-3xl font-semibold sm:text-4xl">
            {about.title}
          </h2>
          <div className="mt-5 space-y-4 text-lg text-ink-500">
            {about.paragraphs.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
