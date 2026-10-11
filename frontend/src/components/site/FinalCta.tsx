import { CalendarHeart } from 'lucide-react';
import { ButtonLink } from '@/components/ui/Button';
import { Blob } from '@/components/brand/BrandShapes';
import { PawHeartIcon, SparkleIcon } from '@/components/brand/BrandIcons';
import { siteContent } from '@/data/content';
import { FUR, PetIllustration, THEME } from './PetIllustration';

export function FinalCta() {
  return (
    <section className="pb-20 pt-4" aria-labelledby="cta-titulo">
      <div className="container-page">
        <div className="sunburst relative overflow-hidden rounded-[2.5rem] px-6 py-14 text-center shadow-soft sm:px-12">
          <Blob tone="accent" className="absolute -left-16 -top-20 h-48 w-48 opacity-90" />
          <Blob tone="leaf" className="absolute -bottom-20 -right-14 h-52 w-52 opacity-90" />
          <PetIllustration className="absolute -bottom-6 -left-6 hidden w-40 sm:block" kind="cat" {...FUR.orange} />
          <PetIllustration className="absolute -right-4 -top-4 hidden w-36 rotate-12 sm:block" {...FUR.cream} accessory="bandana" accent={THEME.accent} />
          <SparkleIcon className="absolute left-[18%] top-8 hidden h-7 w-7 text-accent sm:block" />
          <PawHeartIcon className="mx-auto mb-3 h-10 w-10 text-accent" />
          <h2 id="cta-titulo" className="title-display relative text-display-section text-white">
            {siteContent.finalCta.title}
          </h2>
          <p className="relative mx-auto mt-4 max-w-md text-brand-50">{siteContent.finalCta.text}</p>
          <ButtonLink to="/agendar" size="lg" variant="accent" className="relative mt-8" icon={<CalendarHeart className="h-5 w-5" aria-hidden />}>
            AGENDAR AGORA
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
