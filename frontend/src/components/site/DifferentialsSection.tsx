import { Clock, Heart, MessageCircle, ShieldCheck, Sparkles, Tag, type LucideIcon } from 'lucide-react';
import { siteContent } from '@/data/content';
import { Section } from './Section';

const icons: Record<string, LucideIcon> = { heart: Heart, sparkles: Sparkles, shield: ShieldCheck, clock: Clock, message: MessageCircle, tag: Tag };

export function DifferentialsSection() {
  return (
    <Section id="diferenciais" eyebrow="Diferenciais" title="Por que escolher a Karolla Pet">
      <ul className="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
        {siteContent.differentials.map((d) => {
          const Icon = icons[d.icon] ?? Heart;
          return (
            <li key={d.title} className="flex gap-4">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-coral-100 text-coral-600">
                <Icon className="h-6 w-6" aria-hidden />
              </span>
              <div>
                <h3 className="text-lg font-semibold">{d.title}</h3>
                <p className="mt-1 text-sm text-ink-500">{d.text}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
