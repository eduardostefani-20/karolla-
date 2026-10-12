import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import type { PublicComment } from '@karolla/shared';
import { useOptionalCustomerAuth } from '@/context/CustomerAuthContext';
import { useCatalog } from '@/context/CatalogContext';
import { useAsync } from '@/hooks/useAsync';
import { publicApi } from '@/services/publicApi';
import { accountApi } from '@/services/accountApi';
import { friendlyMessage } from '@/services/api';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Field';

/** Comentários da foto. Só clientes com conta comentam; o texto é exibido como texto puro. */
export function InspirationComments({ inspirationId }: { inspirationId: string }) {
  const { catalog } = useCatalog();
  const auth = useOptionalCustomerAuth();
  const enabled = catalog?.features.customerAccounts ?? false;
  const { data, setData, error: loadError } = useAsync(() => (enabled ? publicApi.inspirationComments(inspirationId) : Promise.resolve([] as PublicComment[])), [inspirationId, enabled]);
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  if (!enabled || loadError) return null;

  const send = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSending(true);
    try {
      const created = await accountApi.addComment(inspirationId, body);
      setData([...(data ?? []), created]);
      setBody('');
    } catch (err) {
      setError(friendlyMessage(err));
    } finally {
      setSending(false);
    }
  };

  const linked = auth?.status === 'authenticated' && auth.account?.status === 'linked';

  return (
    <section aria-label="Comentários" className="border-t border-ink-900/10 pt-3">
      <h3 className="text-sm font-bold text-ink-700">Comentários ({data?.length ?? 0})</h3>
      <ul className="mt-2 max-h-40 space-y-2 overflow-y-auto text-sm" data-testid="comments">
        {data?.map((c) => (
          <li key={c.id}>
            <strong>{c.authorName}</strong> <span className="whitespace-pre-wrap break-words text-ink-700">{c.body}</span>
          </li>
        ))}
      </ul>
      {linked ? (
        <form onSubmit={send} className="mt-2 space-y-2">
          <Textarea aria-label="Escreva um comentário" rows={2} maxLength={500} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Escreva um comentário…" />
          {error && <p className="text-sm font-semibold text-danger-600">{error}</p>}
          <Button type="submit" size="sm" loading={sending} disabled={body.trim().length < 2}>Comentar</Button>
        </form>
      ) : (
        <p className="mt-2 text-sm text-ink-500">
          <Link to="/minha-conta/entrar" className="font-semibold text-brand-700 underline">Entre na sua conta</Link> para comentar.
        </p>
      )}
    </section>
  );
}
