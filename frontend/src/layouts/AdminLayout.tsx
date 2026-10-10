import { Suspense, useState } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation } from 'react-router-dom';
import {
  CalendarDays,
  Clapperboard,
  Images,
  IdCard,
  ClipboardList,
  ClipboardPen,
  Clock,
  ExternalLink,
  LayoutDashboard,
  LogOut,
  Menu,
  PawPrint,
  PlusCircle,
  Scissors,
  Settings,
  Tags,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Logo } from '@/components/site/Logo';
import { Spinner } from '@/components/ui/Feedback';
import { cn } from '@/utils/cn';

const NAV: { to: string; label: string; icon: LucideIcon; end?: boolean }[] = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/agenda', label: 'Agenda', icon: CalendarDays },
  { to: '/admin/agendamentos', label: 'Agendamentos', icon: ClipboardList },
  { to: '/admin/clientes', label: 'Clientes', icon: Users },
  { to: '/admin/pets', label: 'Pets', icon: PawPrint },
  { to: '/admin/profissionais', label: 'Profissionais', icon: IdCard },
  { to: '/admin/servicos', label: 'Serviços', icon: Scissors },
  { to: '/admin/precos', label: 'Preços', icon: Tags },
  { to: '/admin/adicionais', label: 'Adicionais', icon: PlusCircle },
  { to: '/admin/inspiracoes', label: 'Inspirações', icon: Images },
  { to: '/admin/stories', label: 'Stories', icon: Clapperboard },
  { to: '/admin/formulario', label: 'Formulário', icon: ClipboardPen },
  { to: '/admin/horarios', label: 'Horários', icon: Clock },
  { to: '/admin/configuracoes', label: 'Configurações', icon: Settings },
];

/** Protege todas as rotas /admin: sem sessão válida → /admin/login. */
export function RequireAuth() {
  const { status } = useAuth();
  const location = useLocation();
  if (status === 'checking') return <Spinner label="Verificando acesso..." className="min-h-dvh" />;
  if (status !== 'authenticated') return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
  return <AdminLayout />;
}

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <ul className="space-y-1">
      {NAV.map(({ to, label, icon: Icon, end }) => (
        <li key={to}>
          <NavLink
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-2xl px-4 py-2.5 text-[15px] font-semibold transition-colors',
                isActive ? 'bg-brand-600 text-white shadow-soft' : 'text-ink-600 hover:bg-brand-50 hover:text-brand-800',
              )
            }
          >
            <Icon className="h-5 w-5" aria-hidden />
            {label}
          </NavLink>
        </li>
      ))}
    </ul>
  );
}

function AdminLayout() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-dvh bg-cream-50 lg:grid lg:grid-cols-[260px_1fr]">
      <a href="#admin-conteudo" className="sr-only-focusable absolute left-4 top-2 z-50 rounded-full bg-white px-4 py-2 font-semibold">
        Pular para o conteúdo
      </a>
      {/* Sidebar desktop */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-ink-900/5 bg-white px-4 py-6 lg:flex">
        <Link to="/admin" className="mb-8 px-2">
          <Logo />
        </Link>
        <nav aria-label="Painel administrativo" className="scroll-thin flex-1 overflow-y-auto">
          <NavItems />
        </nav>
        <div className="mt-4 space-y-2 border-t border-ink-900/5 pt-4">
          <p className="truncate px-2 text-sm font-semibold text-ink-700">{user?.name}</p>
          <p className="truncate px-2 text-xs text-ink-400">{user?.email}</p>
          <div className="flex gap-1">
            <a href="/" target="_blank" rel="noopener noreferrer" className="flex flex-1 items-center gap-2 rounded-xl px-2 py-2 text-sm text-ink-500 hover:bg-ink-900/5">
              <ExternalLink className="h-4 w-4" aria-hidden /> Ver site
            </a>
            <button type="button" onClick={logout} className="flex flex-1 items-center gap-2 rounded-xl px-2 py-2 text-sm text-ink-500 hover:bg-ink-900/5">
              <LogOut className="h-4 w-4" aria-hidden /> Sair
            </button>
          </div>
        </div>
      </aside>

      {/* Barra superior mobile */}
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-ink-900/5 bg-white/95 px-4 backdrop-blur lg:hidden">
        <Link to="/admin" aria-label="Dashboard">
          <Logo className="scale-90" />
        </Link>
        <button type="button" onClick={() => setOpen(true)} className="rounded-full p-2.5 hover:bg-ink-900/5" aria-label="Abrir menu" aria-expanded={open}>
          <Menu className="h-6 w-6" />
        </button>
      </header>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink-900/40" onClick={() => setOpen(false)} aria-hidden />
          <nav aria-label="Painel administrativo" className="absolute inset-y-0 right-0 flex w-[82%] max-w-xs animate-fade-up flex-col bg-white p-5">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-sm font-semibold text-ink-500">{user?.name}</span>
              <button type="button" onClick={() => setOpen(false)} className="rounded-full p-2 hover:bg-ink-900/5" aria-label="Fechar menu">
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <NavItems onNavigate={() => setOpen(false)} />
            </div>
            <button type="button" onClick={logout} className="mt-4 flex items-center gap-2 rounded-2xl px-4 py-3 font-semibold text-ink-600 hover:bg-ink-900/5">
              <LogOut className="h-5 w-5" aria-hidden /> Sair
            </button>
          </nav>
        </div>
      )}

      <main id="admin-conteudo" className="min-w-0 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
        <Suspense fallback={<Spinner />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}
