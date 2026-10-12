import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { LockKeyhole } from 'lucide-react';
import { loginSchema, type LoginInput } from '@karolla/shared';
import { useAuth } from '@/context/AuthContext';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { friendlyMessage } from '@/services/api';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { Alert } from '@/components/ui/Feedback';
import { Logo } from '@/components/site/Logo';
import { authApi } from '@/services/adminApi';
import { emailSchema } from '@karolla/shared';

export default function LoginPage() {
  useDocumentMeta({ title: 'Área administrativa — Karolla Pet', noindex: true });
  const { status, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  if (status === 'authenticated') return <Navigate to="/admin" replace />;

  const onSubmit = async (data: LoginInput) => {
    setError(null);
    try {
      await login(data.email, data.password);
      navigate((location.state as { from?: string } | null)?.from ?? '/admin', { replace: true });
    } catch (err) {
      setError(friendlyMessage(err));
    }
  };

  return (
    <div className="sunburst grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="card p-8 sm:p-10">
          <div className="mb-8 text-center">
            <Logo size="lg" className="mx-auto" />
            <h1 className="mt-6 flex items-center justify-center gap-2 text-xl font-extrabold">
              <LockKeyhole className="h-5 w-5 text-brand-600" aria-hidden /> Área administrativa
            </h1>
          </div>
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
            {error && <Alert tone="error">{error}</Alert>}
            <Field label="E-mail" required error={errors.email?.message}>
              {(p) => <Input {...p} {...register('email')} type="email" autoComplete="username" inputMode="email" />}
            </Field>
            <Field label="Senha" required error={errors.password?.message}>
              {(p) => <Input {...p} {...register('password')} type="password" autoComplete="current-password" />}
            </Field>
            <Button type="submit" size="lg" variant="primary" block loading={isSubmitting}>
              ENTRAR
            </Button>
          </form>
          <ForgotPassword />
        </div>
        <p className="mt-6 text-center text-xs text-brand-50">Acesso restrito à equipe da Karolla Pet.</p>
      </div>
    </div>
  );
}

/** Pede o link de redefinição. A resposta é sempre a mesma (não revela se o e-mail tem conta). */
function ForgotPassword() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="mt-5 block w-full text-center text-sm font-semibold text-brand-700 underline-offset-2 hover:underline">
        Esqueci minha senha
      </button>
    );
  }
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? 'E-mail inválido.');
    setError(null);
    setSending(true);
    try {
      await authApi.forgotPassword(parsed.data);
      setSent(true);
    } catch (err) {
      setError(friendlyMessage(err));
    } finally {
      setSending(false);
    }
  };
  return (
    <form onSubmit={submit} noValidate className="mt-6 space-y-4 border-t border-ink-900/10 pt-6">
      {sent ? (
        <Alert tone="success">Se este e-mail tiver acesso ao painel, você vai receber um link para criar uma senha nova. Confira também o spam.</Alert>
      ) : (
        <>
          <Field label="E-mail da sua conta" required error={error ?? undefined}>
            {(p) => <Input {...p} type="email" autoComplete="username" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} />}
          </Field>
          <Button type="submit" variant="outline" block loading={sending}>
            Enviar link de redefinição
          </Button>
        </>
      )}
    </form>
  );
}
