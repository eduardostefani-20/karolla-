import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle, Trash2 } from 'lucide-react';
import type { AdminComment } from '@karolla/shared';
import { adminApi } from '@/services/adminApi';
import { friendlyMessage } from '@/services/api';
import { useAsync } from '@/hooks/useAsync';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { useAuth } from '@/context/AuthContext';
import { Alert, Badge, EmptyState, Spinner } from '@/components/ui/Feedback';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { PageHeader } from '@/components/admin/AdminUi';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { cn } from '@/utils/cn';

const dateTime = (iso: string) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

/** Moderação dos comentários das inspirações. Remover tira da página; o cadastro do cliente continua. */
export default function CommentsPage() {
  useDocumentMeta({ title: 'Comentários — Karolla Pet', noindex: true });
  const toast = useToast();
  const { can } = useAuth();
  const { data, loading, error, reload } = useAsync(() => adminApi.comments(), []);
  const [filter, setFilter] = useState<'visible' | 'removed'>('visible');
  const [toRemove, setToRemove] = useState<AdminComment | null>(null);

  const remove = async () => {
    if (!toRemove) return;
    try {
      await adminApi.removeComment(toRemove.id);
      toast('Comentário removido da página.');
      await reload();
    } catch (err) {
      toast(friendlyMessage(err), 'error');
    } finally {
      setToRemove(null);
    }
  };

  const items = (data ?? []).filter((c) => c.status === filter);
  const count = (s: AdminComment['status']) => (data ?? []).filter((c) => c.status === s).length;

  return (
    <div>
      <PageHeader
        title="Comentários"
        description="Comentários de clientes com conta nas fotos de inspiração. Só aparecem para quem está logado; remover não apaga o cliente."
      />
      <div className="mb-5 flex flex-wrap gap-2" role="tablist" aria-label="Filtrar comentários">
        {(['visible', 'removed'] as const).map((s) => (
          <button
            key={s}
            type="button"
            role="tab"
            aria-selected={filter === s}
            onClick={() => setFilter(s)}
            className={cn('rounded-full px-4 py-2 text-sm font-bold', filter === s ? 'bg-brand-600 text-white' : 'bg-white text-ink-600 hover:bg-brand-50')}
          >
            {s === 'visible' ? 'Publicados' : 'Removidos'} {data && <span className="opacity-80">({count(s)})</span>}
          </button>
        ))}
      </div>
      {loading && !data && <Spinner />}
      {error && <Alert tone="error">{error}</Alert>}
      {data && items.length === 0 && (
        <EmptyState icon={<MessageCircle className="h-10 w-10" />} title={filter === 'visible' ? 'Nenhum comentário publicado' : 'Nenhum comentário removido'} />
      )}
      {items.length > 0 && (
        <ul className="space-y-3">
          {items.map((c) => (
            <li key={c.id} className="card flex items-start gap-3 p-4" data-testid="admin-comment">
              <div className="min-w-0 flex-1">
                <p className="text-sm text-ink-500">
                  <Link to={`/admin/clientes/${c.customerId}`} className="font-bold text-ink-800 hover:underline">
                    {c.customerName || c.authorName}
                  </Link>{' '}
                  em <span className="font-semibold text-ink-700">{c.inspirationTitle || 'inspiração removida'}</span> • {dateTime(c.createdAt)}
                  {c.status === 'removed' && <Badge className="ml-2 bg-ink-900/10 text-ink-600">Removido</Badge>}
                </p>
                {/* Texto simples: o React escapa o conteúdo (sem HTML). */}
                <p className="mt-1 whitespace-pre-line break-words text-ink-800">{c.body}</p>
              </div>
              {c.status === 'visible' && can('comments.delete') && (
                <Button size="sm" variant="ghost" aria-label="Remover comentário" onClick={() => setToRemove(c)} icon={<Trash2 className="h-4 w-4 text-danger-500" />} />
              )}
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={Boolean(toRemove)}
        title="Remover comentário?"
        message="O comentário sai da página da inspiração. O cadastro do cliente não é alterado."
        confirmLabel="Remover"
        danger
        onConfirm={remove}
        onClose={() => setToRemove(null)}
      />
    </div>
  );
}
