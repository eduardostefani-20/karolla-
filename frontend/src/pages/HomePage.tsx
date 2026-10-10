import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { Hero } from '@/components/site/Hero';
import { AboutSection } from '@/components/site/AboutSection';
import { ServicesSection } from '@/components/site/ServicesSection';
import { HowItWorksSection } from '@/components/site/HowItWorksSection';
import { DifferentialsSection } from '@/components/site/DifferentialsSection';
import { InspirationsSection } from '@/components/site/InspirationsSection';
import { StoriesBar } from '@/components/stories/StoriesBar';
import { FaqSection } from '@/components/site/FaqSection';
import { FinalCta } from '@/components/site/FinalCta';
import { siteContent } from '@/data/content';
import { useCatalog } from '@/context/CatalogContext';
import { instagramProfileUrl, type PublicCatalog } from '@karolla/shared';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function structuredData(catalog: PublicCatalog | null) {
  const s = catalog?.settings;
  const instagram = instagramProfileUrl(s?.instagram);
  return {
    '@context': 'https://schema.org',
    '@type': 'PetStore',
    name: s?.businessName || 'Karolla Pet',
    description: siteContent.hero.subtitle,
    url: `${__SITE_URL__}/`,
    image: `${__SITE_URL__}/og-image.png`,
    ...(s?.whatsappNumber ? { telephone: `+${s.whatsappNumber}` } : {}),
    ...(s?.contactEmail ? { email: s.contactEmail } : {}),
    ...(s?.addressLine || s?.city
      ? { address: { '@type': 'PostalAddress', streetAddress: s.addressLine || undefined, addressLocality: s.city || undefined, addressCountry: 'BR' } }
      : {}),
    ...(instagram ? { sameAs: [instagram] } : {}),
    openingHoursSpecification: (catalog?.businessHours ?? [])
      .filter((h) => h.isOpen)
      .map((h) => ({ '@type': 'OpeningHoursSpecification', dayOfWeek: DAY_NAMES[h.weekday], opens: h.openTime, closes: h.closeTime })),
  };
}

export default function HomePage() {
  useDocumentMeta({
    title: 'Karolla Pet — Banho, tosa e estética pet com agendamento online',
    description: 'Karolla Pet: banho, tosa e cuidados estéticos para cães e gatos. Agende online em poucos passos, com preço na hora e confirmação pelo WhatsApp.',
  });
  const { catalog } = useCatalog();
  const { hash } = useLocation();
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth' });
  }, [hash]);

  return (
    <>
      <div className="container-page pt-4">
        <StoriesBar />
      </div>
      <Hero />
      <AboutSection />
      <ServicesSection />
      <HowItWorksSection />
      <DifferentialsSection />
      <InspirationsSection />
      <FaqSection />
      <FinalCta />
      <script
        type="application/ld+json"
        // Dados estruturados (SEO local): nome, endereço, telefone e horários vêm do painel
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData(catalog)).replace(/</g, '\\u003c') }}
      />
    </>
  );
}
