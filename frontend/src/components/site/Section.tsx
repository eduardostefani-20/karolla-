import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

export function Section({ id, eyebrow, title, intro, children, className }: { id?: string; eyebrow?: string; title: string; intro?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section id={id} aria-labelledby={id ? `${id}-titulo` : undefined} className={cn('scroll-mt-20 py-16 sm:py-24', className)}>
      <div className="container-page">
        <div className="mx-auto mb-10 max-w-2xl text-center sm:mb-14">
          {eyebrow && <span className="eyebrow">{eyebrow}</span>}
          <h2 id={id ? `${id}-titulo` : undefined} className="mt-4 text-3xl font-semibold sm:text-4xl">
            {title}
          </h2>
          {intro && <p className="mt-4 text-base text-ink-500 sm:text-lg">{intro}</p>}
        </div>
        {children}
      </div>
    </section>
  );
}
