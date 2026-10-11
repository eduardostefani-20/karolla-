import { FUR, PetIllustration, THEME } from './PetIllustration';

/** Composição do hero: cachorrinho no banho de espuma + gatinho, com elementos flutuantes. */
export function HeroArt() {
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[520px]" role="img" aria-label="Ilustração de um cachorro feliz tomando banho de espuma ao lado de um gatinho com laço">
      <div className="absolute inset-[6%] rounded-full border-[10px] border-white bg-gradient-to-br from-sun-100 via-white to-brand-100 shadow-soft" aria-hidden />
      <div className="absolute right-[4%] top-[8%] h-20 w-20 animate-float rounded-full bg-accent/80 blur-[2px]" aria-hidden />
      <svg viewBox="0 0 400 400" className="absolute inset-0 h-full w-full" aria-hidden>
        {/* banheira */}
        <path d="M60 250 H340 Q336 330 270 338 H130 Q64 330 60 250 Z" className="fill-white stroke-brand-600" strokeWidth="6" />
        <rect x="48" y="238" width="304" height="22" rx="11" className="fill-brand-600" />
        <rect x="110" y="336" width="18" height="26" rx="6" className="fill-brand-600" />
        <rect x="272" y="336" width="18" height="26" rx="6" className="fill-brand-600" />
        {/* patinho */}
        <g transform="translate(300 214)">
          <ellipse cx="0" cy="14" rx="22" ry="14" className="fill-sun-400" />
          <circle cx="10" cy="-2" r="11" className="fill-sun-400" />
          <path d="M20 -2 L30 1 L20 5 Z" className="fill-sun-500" />
          <circle cx="13" cy="-5" r="2" className="fill-ink-800" />
        </g>
      </svg>
      <PetIllustration className="absolute left-[17%] top-[16%] w-[58%] drop-shadow-xl" {...FUR.golden} bubbles title="Cachorro no banho" />
      {/* espuma sobre a borda da banheira */}
      <svg viewBox="0 0 400 400" className="absolute inset-0 h-full w-full" aria-hidden>
        <g className="fill-white stroke-brand-200" strokeWidth="3">
          <circle cx="104" cy="240" r="24" />
          <circle cx="146" cy="232" r="28" />
          <circle cx="196" cy="236" r="26" />
          <circle cx="244" cy="232" r="28" />
          <circle cx="288" cy="242" r="20" />
        </g>
      </svg>
      <PetIllustration
        kind="cat"
        className="absolute bottom-[3%] right-[0%] w-[30%] drop-shadow-lg"
        {...FUR.silver}
        accessory="bow"
        accent={THEME.accent}
        title="Gatinho com laço"
      />
      <div className="absolute bottom-[14%] left-[2%] animate-float rounded-card bg-white px-4 py-3 shadow-soft [animation-delay:-2s]">
        <p className="text-xs font-bold text-ink-500">Agendamento online</p>
        <p className="font-heading text-lg font-extrabold text-primary">em poucos passos ✨</p>
      </div>
    </div>
  );
}
