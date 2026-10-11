import { siteContent } from '@/data/content';
import { Section } from './Section';

export function HowItWorksSection() {
  return (
    <Section id="como-funciona" eyebrow="Como funciona" title="Agendar é rapidinho" className="bg-white">
      <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {siteContent.howItWorks.map((step, i) => (
          <li key={step.title} className="card relative p-6 pt-8">
            <span className="absolute -top-5 left-6 grid h-10 w-10 place-items-center rounded-full bg-accent font-heading text-lg font-extrabold text-primary-dark shadow-soft" aria-hidden>
              {i + 1}
            </span>
            <h3 className="text-lg font-semibold">
              <span className="sr-only">Passo {i + 1}: </span>
              {step.title}
            </h3>
            <p className="mt-2 text-sm text-ink-500">{step.text}</p>
          </li>
        ))}
      </ol>
    </Section>
  );
}
