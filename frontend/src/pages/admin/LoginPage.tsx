import { useState } from 'react';
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
    <div className="grid min-h-dvh place-items-center bg-gradient-to-br from-brand-100 via-cream-100 to-coral-50 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="card p-8 sm:p-10">
          <div className="mb-8 text-center">
            <Logo className="justify-center" />
            <h1 className="mt-6 flex items-center justify-center gap-2 text-xl font-semibold">
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
            <Button type="submit" size="lg" variant="secondary" block loading={isSubmitting}>
              ENTRAR
            </Button>
          </form>
        </div>
        <p className="mt-6 text-center text-xs text-ink-500">Acesso restrito à equipe da Karolla Pet.</p>
      </div>
    </div>
  );
}
