import { memo } from 'react';

/** Cores da marca para usar em ilustrações (seguem src/styles/theme.css). */
export const THEME = {
  brand500: 'rgb(var(--brand-500))',
  coral400: 'rgb(var(--coral-400))',
  sun400: 'rgb(var(--sun-400))',
} as const;

/**
 * Ilustrações vetoriais próprias (leves, sem dependência externa).
 * Placeholder elegante até a Karolla Pet ter fotos reais — veja docs/CONTEUDO.md.
 */
export interface PetIllustrationProps {
  kind?: 'dog' | 'cat';
  fur?: string;
  furDark?: string;
  muzzle?: string;
  accessory?: 'bow' | 'bandana' | 'none';
  accent?: string;
  bubbles?: boolean;
  className?: string;
  title?: string;
}

export const PetIllustration = memo(function PetIllustration({
  kind = 'dog',
  fur = '#e8b77d',
  furDark = '#c98d4f',
  muzzle = '#fff1df',
  accessory = 'none',
  accent = THEME.coral400,
  bubbles = false,
  className,
  title,
}: PetIllustrationProps) {
  return (
    <svg viewBox="0 0 200 200" className={className} role={title ? 'img' : undefined} aria-hidden={title ? undefined : true}>
      {title && <title>{title}</title>}
      {/* corpo */}
      <ellipse cx="100" cy="172" rx="52" ry="30" fill={fur} />
      <ellipse cx="100" cy="178" rx="28" ry="18" fill={muzzle} />
      {accessory === 'bandana' && <path d="M58 140 Q100 168 142 140 L128 158 Q100 182 72 158 Z" style={{ fill: accent }} />}
      {/* orelhas */}
      {kind === 'dog' ? (
        <>
          <ellipse cx="50" cy="92" rx="18" ry="34" fill={furDark} transform="rotate(18 50 92)" />
          <ellipse cx="150" cy="92" rx="18" ry="34" fill={furDark} transform="rotate(-18 150 92)" />
        </>
      ) : (
        <>
          <path d="M52 78 L60 26 L94 56 Z" fill={furDark} />
          <path d="M148 78 L140 26 L106 56 Z" fill={furDark} />
          <path d="M62 66 L66 40 L84 56 Z" fill="#ffc8b3" />
          <path d="M138 66 L134 40 L116 56 Z" fill="#ffc8b3" />
        </>
      )}
      {/* cabeça */}
      <circle cx="100" cy="98" r="54" fill={fur} />
      <ellipse cx="100" cy="122" rx={kind === 'dog' ? 31 : 25} ry={kind === 'dog' ? 23 : 18} fill={muzzle} />
      {/* olhos */}
      <circle cx="79" cy="94" r="6.5" fill="#1c2433" />
      <circle cx="121" cy="94" r="6.5" fill="#1c2433" />
      <circle cx="81" cy="91.5" r="2" fill="#fff" />
      <circle cx="123" cy="91.5" r="2" fill="#fff" />
      {/* bochechas */}
      <ellipse cx="66" cy="114" rx="7" ry="4.5" fill="#ff9f86" opacity=".55" />
      <ellipse cx="134" cy="114" rx="7" ry="4.5" fill="#ff9f86" opacity=".55" />
      {/* focinho */}
      {kind === 'dog' ? (
        <>
          <ellipse cx="100" cy="110" rx="10" ry="7" fill="#1c2433" />
          <path d="M100 117 Q100 126 90 128 M100 117 Q100 126 110 128" stroke="#1c2433" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <path d="M95 129 Q100 141 105 129 Z" fill="#ff7d8a" />
        </>
      ) : (
        <>
          <path d="M94 110 L106 110 L100 117 Z" fill="#ff8f9b" />
          <path d="M100 117 Q100 124 92 125 M100 117 Q100 124 108 125" stroke="#1c2433" strokeWidth="2.2" fill="none" strokeLinecap="round" />
          <path d="M58 112 L80 116 M58 122 L80 120 M142 112 L120 116 M142 122 L120 120" stroke="#1c2433" strokeWidth="1.6" strokeLinecap="round" opacity=".55" />
        </>
      )}
      {accessory === 'bow' && (
        <g transform="translate(128 52) rotate(18)">
          <path d="M0 0 L-18 -11 L-18 11 Z" style={{ fill: accent }} />
          <path d="M0 0 L18 -11 L18 11 Z" style={{ fill: accent }} />
          <circle r="5" fill="#fff" opacity=".9" />
        </g>
      )}
      {bubbles && (
        <g fill="#fff" stroke="#bfe9e5" strokeWidth="2">
          <circle cx="72" cy="48" r="13" />
          <circle cx="92" cy="40" r="16" />
          <circle cx="116" cy="44" r="12" />
          <circle cx="30" cy="140" r="9" />
          <circle cx="172" cy="128" r="11" />
          <circle cx="182" cy="104" r="6" />
        </g>
      )}
    </svg>
  );
});
