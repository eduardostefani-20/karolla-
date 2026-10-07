import { ChevronDown } from 'lucide-react';
import { siteContent } from '@/data/content';
import { Section } from './Section';

export function FaqSection() {
  return (
    <Section id="duvidas" eyebrow="Dúvidas frequentes" title="Perguntas frequentes">
      <div className="mx-auto max-w-3xl space-y-3">
        {siteContent.faq.map((item) => (
          <details key={item.q} className="card group p-0 [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-3xl px-6 py-5 text-left font-semibold text-ink-800">
              {item.q}
              <ChevronDown className="h-5 w-5 shrink-0 text-brand-500 transition-transform group-open:rotate-180" aria-hidden />
            </summary>
            <p className="px-6 pb-6 text-ink-500">{item.a}</p>
          </details>
        ))}
      </div>
    </Section>
  );
}
