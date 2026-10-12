import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { KeyRound } from 'lucide-react';
import { newPasswordSchema } from '@karolla/shared';
import { authApi } from '@/services/adminApi';
import { friendlyMessage } from '@/services/api';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { Alert } from '@/components/ui/Feedback';
import { Logo } from '@/components/site/Logo';

type LinkData = { token: string | null; error: string | null };
let captured: LinkData | null = null;

/**
 * Lê o token do link de redefinição (#access_token=...&type=recovery) e limpa a barra de endereço
 * (o token não fica no histórico). Guardado em memória porque o React pode chamar isto duas vezes.
 */
function readRecoveryToken(): LinkData {
  if (!window.location.hash && captured) return captured;
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const token = params.get('access_token');
  const error = params.get('error_description') ?? params.get('error');
  if (window.location.hash) window.history.replaceState(null, '', window.location.pathname);
  captured = { token: token && params.get('type') === 'recovery' ? token : null, error };
  return captured;
}

/** Página aberta pelo link enviado por e-mail para criar uma senha nova (equipe e, depois, clientes). */
export default function ResetPasswordPage() {
  useDocumentMeta({ title: 'Redefinir senha — Karolla Pet', noindex: true });
  const [{ token, error: linkError }] = useState(readRecoveryToken);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const parsed = newPasswordSchema.safeParse(password);
    if (!parsed.success) return setFieldError(parsed.error.issues[0]?.message ?? 'Senha inválida.');
    if (password !== confirm) return setFieldError('As senhas não conferem.');
    setFieldError(null);
    setSaving(true);
    try {
      await authApi.resetPassword(token!, password);
      setDone(true);
    } catch (err) {
      setError(friendlyMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="sunburst grid min-h-dvh place-items-center px-4 py-10">
      <div className="card w-full max-w-md p-8 sm:p-10">
        <div className="mb-6 text-center">
          <Logo size="lg" className="mx-auto" />
          <h1 className="mt-6 flex items-center justify-center gap-2 text-xl font-extrabold">
            <KeyRound className="h-5 w-5 text-brand-600" aria-hidden /> Criar nova senha
          </h1>
        </div>
        {done ? (
          <div className="space-y-4 text-center">
            <Alert tone="success">Senha alterada! Já pode entrar com a senha nova.</Alert>
            <p className="flex flex-wrap justify-center gap-4">
              <Link to="/minha-conta/entrar" className="font-semibold text-brand-700 underline">Entrar na minha conta</Link>
              <Link to="/admin/login" className="font-semibold text-brand-700 underline">Entrar no painel da equipe</Link>
            </p>
          </div>
        ) : !token ? (
          <Alert tone="error">
            {linkError ? 'Este link expirou ou já foi usado.' : 'Link inválido.'} Peça um novo em “Esqueci minha senha”.
          </Alert>
        ) : (
          <form onSubmit={submit} noValidate className="space-y-5">
            {error && <Alert tone="error">{error}</Alert>}
            <Field label="Nova senha" required hint="8 ou mais caracteres, com letras e números." error={fieldError ?? undefined}>
              {(p) => <Input {...p} type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />}
            </Field>
            <Field label="Repita a nova senha" required>
              {(p) => <Input {...p} type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />}
            </Field>
            <Button type="submit" size="lg" variant="primary" block loading={saving}>
              SALVAR NOVA SENHA
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
