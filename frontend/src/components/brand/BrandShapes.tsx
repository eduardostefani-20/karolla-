import { cn } from '@/utils/cn';

/**
 * Elementos gráficos da marca (SVG inline, leves): ondas divisórias, blobs orgânicos e a faixa sob o título.
 * As cores vêm das classes (fill-*), ligadas aos tokens de src/styles/theme.css.
 */

/** Onda divisória entre seções. `fill` é a cor da seção SEGUINTE (ex.: fill-bg-soft). */
export function WaveDivider({ className, fill = 'fill-bg-soft', flip = false }: { className?: string; fill?: string; flip?: boolean }) {
  return (
    <svg
      viewBox="0 0 1440 90"
      preserveAspectRatio="none"
      aria-hidden
      className={cn('pointer-events-none block h-10 w-full sm:h-16', flip && 'rotate-180', className)}
    >
      <path className={cn(fill, 'opacity-60')} d="M0 42c160-30 330-36 500-12s320 50 500 30 300-48 440-30v60H0Z" />
      <path className={fill} d="M0 60c180-26 360-28 540-8s340 34 520 18 280-38 380-26v46H0Z" />
    </svg>
  );
}

/** Forma orgânica decorativa (amarelo ou verde) para cantos do hero e das faixas. */
export function Blob({ className, tone = 'accent' }: { className?: string; tone?: 'accent' | 'leaf' | 'lilac' }) {
  const fill = { accent: 'fill-accent', leaf: 'fill-secondary', lilac: 'fill-primary-light' }[tone];
  return (
    <svg viewBox="0 0 200 200" aria-hidden className={cn('pointer-events-none', className)}>
      <path
        className={fill}
        d="M43.5 -58.6C55.6 -49.1 63.6 -34.7 68.4 -18.9C73.2 -3.1 74.8 14.1 68.3 27.5C61.8 40.9 47.2 50.5 31.7 58.3C16.2 66.1 -0.2 72.1 -17.6 70.4C-35 68.7 -53.4 59.3 -63.8 44.5C-74.2 29.7 -76.6 9.5 -72.3 -8.4C-68 -26.3 -57 -41.9 -42.9 -51.2C-28.8 -60.5 -11.6 -63.5 3.2 -67.7C18 -71.9 31.4 -68.1 43.5 -58.6Z"
        transform="translate(100 100)"
      />
    </svg>
  );
}

/** Onda branca sob o título principal (lembra o "balão de fala" do logo). */
export function TitleWave({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 320 28" preserveAspectRatio="none" aria-hidden className={cn('pointer-events-none block', className)}>
      <path className="fill-white" d="M6 15C60 3 120 1 170 6s95 12 144 4c4-.6 6 2.6 3 4.6C268 26 214 26 166 21S70 12 22 24c-6 1.6-20-1-16-9Z" />
    </svg>
  );
}
