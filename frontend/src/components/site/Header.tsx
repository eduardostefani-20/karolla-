import { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { CalendarHeart, Menu, X } from 'lucide-react';
import { ButtonLink } from '@/components/ui/Button';
import { cn } from '@/utils/cn';
import { Logo } from './Logo';

const links = [
  { href: '/#sobre', label: 'Sobre' },
  { href: '/#servicos', label: 'Serviços' },
  { href: '/#como-funciona', label: 'Como funciona' },
  { href: '/inspiracoes', label: 'Inspirações' },
  { href: '/#duvidas', label: 'Dúvidas' },
];

export function Header() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className={cn('sticky top-0 z-40 transition-all', scrolled || open ? 'bg-cream-100/95 shadow-sm backdrop-blur' : 'bg-transparent')}>
      <a href="#conteudo" className="sr-only-focusable absolute left-4 top-2 z-50 rounded-full bg-white px-4 py-2 font-semibold">
        Pular para o conteúdo
      </a>
      <div className="container-page flex h-[72px] items-center justify-between gap-4">
        <Link to="/" aria-label="Karolla Pet — início" onClick={() => setOpen(false)}>
          <Logo />
        </Link>
        <nav aria-label="Principal" className="hidden items-center gap-1 lg:flex">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="rounded-full px-3 py-2 text-sm font-semibold text-ink-600 transition-colors hover:bg-brand-50 hover:text-brand-700">
              {l.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <ButtonLink to="/agendar" size="sm" className="hidden sm:inline-flex" icon={<CalendarHeart className="h-4 w-4" aria-hidden />}>
            Agendar agora
          </ButtonLink>
          <button
            type="button"
            className="rounded-full p-2.5 text-ink-700 hover:bg-ink-900/5 lg:hidden"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls="menu-mobile"
            aria-label={open ? 'Fechar menu' : 'Abrir menu'}
          >
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>
      {open && (
        <nav id="menu-mobile" aria-label="Menu" className="container-page animate-fade-up pb-5 lg:hidden">
          <ul className="space-y-1">
            {links.map((l) => (
              <li key={l.href}>
                <a href={l.href} onClick={() => setOpen(false)} className="block rounded-2xl px-4 py-3 text-base font-semibold text-ink-700 hover:bg-brand-50">
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
          <ButtonLink to="/agendar" block size="lg" className="mt-3" onClick={() => setOpen(false)}>
            Agendar agora
          </ButtonLink>
          <NavLink to="/admin" className="mt-3 block text-center text-xs text-ink-400 underline" onClick={() => setOpen(false)}>
            Área administrativa
          </NavLink>
        </nav>
      )}
    </header>
  );
}
