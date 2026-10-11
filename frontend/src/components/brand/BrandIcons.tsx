import type { SVGProps } from 'react';

/**
 * Ícones de apoio da marca KarollaPet — mesmo traço (2px, pontas arredondadas, grade 24×24) dos ícones
 * lucide usados no resto do site. A cor vem de `currentColor` (use classes text-primary, text-accent, text-leaf-600…).
 */
type IconProps = SVGProps<SVGSVGElement> & { title?: string };

function Svg({ title, children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      {...props}
    >
      {title && <title>{title}</title>}
      {children}
    </svg>
  );
}

/** Patinha com a almofada central em formato de coração (como no logo). */
export function PawHeartIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <ellipse cx="5.2" cy="10.4" rx="1.9" ry="2.4" transform="rotate(-18 5.2 10.4)" />
      <ellipse cx="9.3" cy="5.6" rx="1.9" ry="2.5" transform="rotate(-6 9.3 5.6)" />
      <ellipse cx="14.7" cy="5.6" rx="1.9" ry="2.5" transform="rotate(6 14.7 5.6)" />
      <ellipse cx="18.8" cy="10.4" rx="1.9" ry="2.4" transform="rotate(18 18.8 10.4)" />
      <path d="M12 20.5c-.5-.5-5.2-3.3-5.2-6.4a2.6 2.6 0 0 1 5.2-.6 2.6 2.6 0 0 1 5.2.6c0 3.1-4.7 5.9-5.2 6.4Z" />
    </Svg>
  );
}

export function HeartIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 20s-7.5-4.4-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.6-7.5 10-7.5 10Z" />
    </Svg>
  );
}

/** Brilho / estrelinha de quatro pontas. */
export function SparkleIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3c.6 3.9 2.1 5.4 6 6-3.9.6-5.4 2.1-6 6-.6-3.9-2.1-5.4-6-6 3.9-.6 5.4-2.1 6-6Z" />
      <path d="M19 15.5c.3 1.6.9 2.2 2.5 2.5-1.6.3-2.2.9-2.5 2.5-.3-1.6-.9-2.2-2.5-2.5 1.6-.3 2.2-.9 2.5-2.5Z" />
    </Svg>
  );
}

/** Frasco de shampoo pet (como no logo). */
export function ShampooIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M10 2.5h4" />
      <path d="M12 2.5v2.5" />
      <rect x="9" y="5" width="6" height="2.6" rx=".8" />
      <rect x="6.2" y="7.6" width="11.6" height="13.9" rx="3" />
      <path d="M12 17.6c-.3-.3-2.6-1.6-2.6-3.1a1.3 1.3 0 0 1 2.6-.3 1.3 1.3 0 0 1 2.6.3c0 1.5-2.3 2.8-2.6 3.1Z" />
    </Svg>
  );
}
