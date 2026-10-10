import { CalendarHeart } from 'lucide-react';
import { ButtonLink } from '@/components/ui/Button';
import { siteContent } from '@/data/content';
import { PetIllustration, THEME } from './PetIllustration';

export function FinalCta() {
  return (
    <section className="pb-20 pt-4" aria-labelledby="cta-titulo">
      <div className="container-page">
        <div className="relative overflow-hidden rounded-[2.5rem] bg-brand-700 px-6 py-14 text-center sm:px-12">
          <PetIllustration className="absolute -bottom-6 -left-6 hidden w-40 opacity-90 sm:block" kind="cat" fur="#f2a65a" furDark="#d9823a" />
          <PetIllustration className="absolute -right-4 -top-4 hidden w-36 rotate-12 opacity-90 sm:block" fur="#fdfaf6" furDark="#e6d7c3" accessory="bandana" accent={THEME.coral400} />
          <h2 id="cta-titulo" className="text-3xl font-semibold text-white sm:text-5xl">
            {siteContent.finalCta.title}
          </h2>
          <p className="mx-auto mt-4 max-w-md text-brand-100">{siteContent.finalCta.text}</p>
          <ButtonLink to="/agendar" size="lg" className="mt-8" icon={<CalendarHeart className="h-5 w-5" aria-hidden />}>
            AGENDAR AGORA
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
