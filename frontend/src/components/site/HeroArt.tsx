import { PetIllustration } from './PetIllustration';

/** Composição do hero: cachorrinho no banho de espuma + gatinho, com elementos flutuantes. */
export function HeroArt() {
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[520px]" role="img" aria-label="Ilustração de um cachorro feliz tomando banho de espuma ao lado de um gatinho com laço">
      <div className="absolute inset-[6%] rounded-full bg-gradient-to-br from-brand-200 via-brand-100 to-sun-100" aria-hidden />
      <div className="absolute right-[4%] top-[8%] h-20 w-20 animate-float rounded-full bg-coral-200/70 blur-[2px]" aria-hidden />
      <svg viewBox="0 0 400 400" className="absolute inset-0 h-full w-full" aria-hidden>
        {/* banheira */}
        <path d="M60 250 H340 Q336 330 270 338 H130 Q64 330 60 250 Z" fill="#fff" stroke="#1b7a75" strokeWidth="6" />
        <rect x="48" y="238" width="304" height="22" rx="11" fill="#1b7a75" />
        <rect x="110" y="336" width="18" height="26" rx="6" fill="#1b7a75" />
        <rect x="272" y="336" width="18" height="26" rx="6" fill="#1b7a75" />
        {/* patinho */}
        <g transform="translate(300 214)">
          <ellipse cx="0" cy="14" rx="22" ry="14" fill="#ffc533" />
          <circle cx="10" cy="-2" r="11" fill="#ffc533" />
          <path d="M20 -2 L30 1 L20 5 Z" fill="#ff7d57" />
          <circle cx="13" cy="-5" r="2" fill="#1c2433" />
        </g>
      </svg>
      <PetIllustration className="absolute left-[17%] top-[16%] w-[58%] drop-shadow-xl" fur="#f0c58f" furDark="#d39a5c" bubbles title="Cachorro no banho" />
      {/* espuma sobre a borda da banheira */}
      <svg viewBox="0 0 400 400" className="absolute inset-0 h-full w-full" aria-hidden>
        <g fill="#fff" stroke="#bfe9e5" strokeWidth="3">
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
        fur="#9aa5b1"
        furDark="#6b7684"
        muzzle="#f4f6f8"
        accessory="bow"
        accent="#ff7d57"
        title="Gatinho com laço"
      />
      <div className="absolute bottom-[14%] left-[2%] animate-float rounded-2xl bg-white px-4 py-3 shadow-soft [animation-delay:-2s]">
        <p className="text-xs font-semibold text-ink-500">Agendamento online</p>
        <p className="font-display text-lg text-brand-700">em poucos passos ✨</p>
      </div>
    </div>
  );
}
