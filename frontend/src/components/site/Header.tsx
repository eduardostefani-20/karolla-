import { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { CalendarHeart, Menu, UserRound, X } from 'lucide-react';
import { useOptionalCustomerAuth } from '@/context/CustomerAuthContext';
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
  const customer = useOptionalCustomerAuth();
  const accountLabel = customer?.status === 'authenticated' ? 'Minha conta' : 'Entrar';
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className={cn('sticky top-0 z-40 bg-primary transition-shadow', (scrolled || open) && 'shadow-soft')}>
      <a href="#conteudo" className="sr-only-focusable absolute left-4 top-2 z-50 rounded-pill bg-white px-4 py-2 font-bold text-primary">
        Pular para o conteúdo
      </a>
      <div className="container-page flex h-[72px] items-center justify-between gap-4">
        <Link to="/" aria-label="KarollaPet — início" onClick={() => setOpen(false)} className="rounded-pill">
          <Logo size="md" className="w-[150px] sm:w-auto" shadow={false} />
        </Link>
        <nav aria-label="Principal" className="hidden items-center gap-1 lg:flex">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="rounded-pill px-3 py-2 text-sm font-bold text-white/90 transition-colors hover:bg-white/10 hover:text-white">
              {l.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link
            to="/minha-conta"
            className="hidden items-center gap-1.5 rounded-pill px-3 py-2 text-sm font-bold text-white/90 transition-colors hover:bg-white/10 hover:text-white sm:inline-flex"
          >
            <UserRound className="h-4 w-4" aria-hidden /> {accountLabel}
          </Link>
          <ButtonLink to="/agendar" size="sm" variant="accent" className="hidden sm:inline-flex" icon={<CalendarHeart className="h-4 w-4" aria-hidden />}>
            Agendar agora
          </ButtonLink>
          <button
            type="button"
            className="rounded-pill p-2.5 text-white hover:bg-white/10 lg:hidden"
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
                <a href={l.href} onClick={() => setOpen(false)} className="block rounded-card px-4 py-3 text-base font-bold text-white hover:bg-white/10">
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
          <Link to="/minha-conta" onClick={() => setOpen(false)} className="mt-1 flex items-center gap-2 rounded-card px-4 py-3 text-base font-bold text-white hover:bg-white/10">
            <UserRound className="h-5 w-5" aria-hidden /> {accountLabel === 'Entrar' ? 'Entrar / Minha conta' : 'Minha conta'}
          </Link>
          <ButtonLink to="/agendar" block size="lg" variant="accent" className="mt-3" onClick={() => setOpen(false)}>
            Agendar agora
          </ButtonLink>
          <NavLink to="/admin" className="mt-3 block text-center text-xs text-brand-100 underline" onClick={() => setOpen(false)}>
            Área administrativa
          </NavLink>
        </nav>
      )}
    </header>
  );
}
