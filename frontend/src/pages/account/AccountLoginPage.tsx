import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { UserRound } from 'lucide-react';
import { accountSignupSchema, emailSchema } from '@karolla/shared';
import { useCustomerAuth } from '@/context/CustomerAuthContext';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { accountApi } from '@/services/accountApi';
import { ApiError, friendlyMessage } from '@/services/api';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { Alert } from '@/components/ui/Feedback';
import { cn } from '@/utils/cn';

/** Entrar ou criar conta na área do cliente. */
export default function AccountLoginPage() {
  useDocumentMeta({ title: 'Minha conta — Karolla Pet', noindex: true });
  const { status, login, startSession } = useCustomerAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [tab, setTab] = useState<'entrar' | 'criar'>(params.get('criar') ? 'criar' : 'entrar');
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [confirmSent, setConfirmSent] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', whatsapp: '', password: '', acceptPrivacy: false });
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  if (status === 'authenticated') return <Navigate to="/minha-conta" replace />;

  const submitLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(form.email, form.password);
      navigate('/minha-conta', { replace: true });
    } catch (err) {
      setError(friendlyMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const submitSignup = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setErrors({});
    const parsed = accountSignupSchema.safeParse(form);
    if (!parsed.success) {
      const fields: Record<string, string> = {};
      for (const issue of parsed.error.issues) fields[String(issue.path[0])] ??= issue.message;
      setErrors(fields);
      return;
    }
    setBusy(true);
    try {
      const result = await accountApi.signUp(form);
      if (result.session) {
        startSession(result.session);
        navigate('/minha-conta', { replace: true });
      } else {
        setConfirmSent(true);
      }
    } catch (err) {
      if (err instanceof ApiError) setErrors(err.fields);
      setError(friendlyMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container-page py-10 sm:py-14">
      <div className="card mx-auto max-w-md p-6 sm:p-8">
        <h1 className="flex items-center gap-2 text-2xl font-extrabold text-ink-900">
          <UserRound className="h-6 w-6 text-brand-600" aria-hidden /> Minha conta
        </h1>
        <p className="mt-1 text-sm text-ink-600">Acompanhe seus agendamentos e mantenha os dados dos seus pets em dia.</p>
        {params.get('confirmado') && <Alert tone="success" className="mt-4">E-mail confirmado! Agora é só entrar.</Alert>}

        <div className="mt-6 grid grid-cols-2 gap-1 rounded-pill bg-lilac-50 p-1" role="tablist" aria-label="Acesso">
          {(['entrar', 'criar'] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => {
                setTab(t);
                setError(null);
              }}
              className={cn('rounded-pill py-2 text-sm font-bold', tab === t ? 'bg-white text-brand-800 shadow-soft' : 'text-ink-600')}
            >
              {t === 'entrar' ? 'Entrar' : 'Criar conta'}
            </button>
          ))}
        </div>

        {error && <Alert tone="error" className="mt-5">{error}</Alert>}

        {tab === 'entrar' ? (
          <>
            <form onSubmit={submitLogin} noValidate className="mt-5 space-y-4">
              <Field label="E-mail" required>
                {(p) => <Input {...p} type="email" autoComplete="username" inputMode="email" value={form.email} onChange={(e) => set({ email: e.target.value })} />}
              </Field>
              <Field label="Senha" required>
                {(p) => <Input {...p} type="password" autoComplete="current-password" value={form.password} onChange={(e) => set({ password: e.target.value })} />}
              </Field>
              <Button type="submit" variant="primary" size="lg" block loading={busy}>ENTRAR</Button>
            </form>
            <ForgotPassword />
          </>
        ) : confirmSent ? (
          <Alert tone="success" className="mt-5" title="Quase lá!">
            Enviamos um link de confirmação para <strong>{form.email}</strong>. Abra o e-mail e confirme para entrar (confira também o spam).
          </Alert>
        ) : (
          <form onSubmit={submitSignup} noValidate className="mt-5 space-y-4">
            <Field label="Seu nome" required error={errors.name}>
              {(p) => <Input {...p} autoComplete="name" value={form.name} onChange={(e) => set({ name: e.target.value })} />}
            </Field>
            <Field label="E-mail" required hint="Use o mesmo e-mail dos seus agendamentos para ver o histórico." error={errors.email}>
              {(p) => <Input {...p} type="email" autoComplete="email" inputMode="email" value={form.email} onChange={(e) => set({ email: e.target.value })} />}
            </Field>
            <Field label="WhatsApp" required error={errors.whatsapp}>
              {(p) => <Input {...p} type="tel" autoComplete="tel" inputMode="tel" placeholder="(11) 99999-9999" value={form.whatsapp} onChange={(e) => set({ whatsapp: e.target.value })} />}
            </Field>
            <Field label="Senha" required hint="8 ou mais caracteres, com letras e números." error={errors.password}>
              {(p) => <Input {...p} type="password" autoComplete="new-password" value={form.password} onChange={(e) => set({ password: e.target.value })} />}
            </Field>
            <label className="flex items-start gap-3 text-sm text-ink-700">
              <input type="checkbox" className="mt-0.5 h-5 w-5 accent-brand-600" checked={form.acceptPrivacy} onChange={(e) => set({ acceptPrivacy: e.target.checked })} />
              <span>
                Li e aceito a <Link to="/privacidade" className="font-semibold text-brand-700 underline" target="_blank">política de privacidade</Link>.
              </span>
            </label>
            {errors.acceptPrivacy && <p className="text-sm font-semibold text-danger-600">{errors.acceptPrivacy}</p>}
            <Button type="submit" variant="primary" size="lg" block loading={busy}>CRIAR CONTA</Button>
          </form>
        )}
      </div>
    </div>
  );
}

function ForgotPassword() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="mt-4 block w-full text-center text-sm font-semibold text-brand-700 underline-offset-2 hover:underline">
        Esqueci minha senha
      </button>
    );
  }
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? 'E-mail inválido.');
    setError(null);
    setBusy(true);
    try {
      await accountApi.forgotPassword(parsed.data);
      setSent(true);
    } catch (err) {
      setError(friendlyMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} noValidate className="mt-5 space-y-3 border-t border-ink-900/10 pt-5">
      {sent ? (
        <Alert tone="success">Se este e-mail tiver conta, você vai receber um link para criar uma senha nova.</Alert>
      ) : (
        <>
          <Field label="E-mail da sua conta" required error={error ?? undefined}>
            {(p) => <Input {...p} type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} />}
          </Field>
          <Button type="submit" variant="outline" block loading={busy}>Enviar link</Button>
        </>
      )}
    </form>
  );
}
