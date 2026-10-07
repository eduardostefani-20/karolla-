import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { Hero } from '@/components/site/Hero';
import { AboutSection } from '@/components/site/AboutSection';
import { ServicesSection } from '@/components/site/ServicesSection';
import { HowItWorksSection } from '@/components/site/HowItWorksSection';
import { DifferentialsSection } from '@/components/site/DifferentialsSection';
import { GallerySection } from '@/components/site/GallerySection';
import { FaqSection } from '@/components/site/FaqSection';
import { FinalCta } from '@/components/site/FinalCta';
import { siteContent } from '@/data/content';

export default function HomePage() {
  useDocumentMeta({
    title: 'Karolla Pet — Banho, tosa e estética pet com agendamento online',
    description: 'Karolla Pet: banho, tosa e cuidados estéticos para cães e gatos. Agende online em poucos passos, com preço na hora e confirmação pelo WhatsApp.',
  });
  const { hash } = useLocation();
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth' });
  }, [hash]);

  return (
    <>
      <Hero />
      <AboutSection />
      <ServicesSection />
      <HowItWorksSection />
      <DifferentialsSection />
      <GallerySection />
      <FaqSection />
      <FinalCta />
      <script
        type="application/ld+json"
        // Dados estruturados (SEO local)
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'PetStore',
            name: 'Karolla Pet',
            description: siteContent.hero.subtitle,
          }),
        }}
      />
    </>
  );
}
