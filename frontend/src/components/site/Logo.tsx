import { cn } from '@/utils/cn';

/** Proporção do arquivo do logo (largura ÷ altura) — evita "pulo" de layout enquanto a imagem carrega. */
const RATIO = 1926 / 544;

const HEIGHTS = { xs: 28, sm: 36, md: 48, lg: 64, xl: 96 } as const;

/**
 * Logo oficial KarollaPet (estilo adesivo: contorno branco + sombra roxa suave para não sumir em fundo claro).
 * Arquivos em /public/brand (WebP com reserva em PNG, fundo transparente).
 */
export function Logo({ className, size = 'md', shadow = true }: { className?: string; size?: keyof typeof HEIGHTS; shadow?: boolean }) {
  const height = HEIGHTS[size];
  const width = Math.round(height * RATIO);
  return (
    <picture className={cn('inline-block shrink-0', className)}>
      <source type="image/webp" srcSet="/brand/karollapet-logo-480.webp 480w, /brand/karollapet-logo-960.webp 960w" sizes={`${width}px`} />
      <img
        src="/brand/karollapet-logo-960.png"
        alt="KarollaPet"
        width={width}
        height={height}
        decoding="async"
        className={cn('block h-auto max-w-full', shadow && 'logo-sticker')}
        style={{ width, aspectRatio: `${RATIO}` }}
      />
    </picture>
  );
}
