import { useEffect, useState } from 'react';
import { Clock, Plus, Trash2, Clapperboard } from 'lucide-react';
import type { Story } from '@karolla/shared';
import { adminApi } from '@/services/adminApi';
import { friendlyMessage } from '@/services/api';
import { useAsync } from '@/hooks/useAsync';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { Alert, EmptyState, Spinner } from '@/components/ui/Feedback';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { PageHeader } from '@/components/admin/AdminUi';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { MediaPicker } from '@/components/admin/MediaPicker';

function remaining(expiresAt: string, now: number): string {
  const ms = Date.parse(expiresAt) - now;
  if (ms <= 0) return 'expirado';
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `some em ${h} h ${m} min` : `some em ${m} min`;
}

/** Stories: fotos e vídeos que somem sozinhos 24 horas depois de publicados. */
export default function StoriesAdminPage() {
  useDocumentMeta({ title: 'Stories — Karolla Pet', noindex: true });
  const toast = useToast();
  const { data, loading, error, reload } = useAsync(() => adminApi.stories(), []);
  const [creating, setCreating] = useState<{ url: string; path: string; mediaType: 'image' | 'video'; caption: string } | null>(null);
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<Story | null>(null);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const publish = async () => {
    if (!creating) return;
    setSaving(true);
    try {
      await adminApi.createStory({ mediaType: creating.mediaType, mediaUrl: creating.url, storagePath: creating.path, caption: creating.caption });
      toast('Story publicado! Some sozinho em 24 horas.');
      setCreating(null);
      setPicking(false);
      await reload();
    } catch (err) {
      toast(friendlyMessage(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!toDelete) return;
    try {
      await adminApi.deleteStory(toDelete.id);
      toast('Story excluído.');
      await reload();
    } catch (err) {
      toast(friendlyMessage(err), 'error');
    } finally {
      setToDelete(null);
    }
  };

  const visible = (data ?? []).filter((s) => Date.parse(s.expiresAt) > now);

  return (
    <div>
      <PageHeader
        title="Stories"
        description="Publique fotos e vídeos do dia. Cada story fica no site por 24 horas e depois some automaticamente."
        actions={<Button onClick={() => setPicking(true)} icon={<Plus className="h-4 w-4" />}>Novo story</Button>}
      />
      {loading && !data && <Spinner />}
      {error && <Alert tone="error">{error}</Alert>}
      {data && visible.length === 0 && <EmptyState icon={<Clapperboard className="h-10 w-10" />} title="Nenhum story no ar">Os stories aparecem no topo da página inicial e das inspirações.</EmptyState>}
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {visible.map((s) => (
          <li key={s.id} className="card overflow-hidden" data-testid="admin-story">
            <div className="aspect-[9/16] bg-ink-900">
              {s.mediaType === 'video' ? <video src={s.mediaUrl} className="h-full w-full object-cover" muted playsInline controls /> : <img src={s.mediaUrl} alt={s.caption || 'Story'} className="h-full w-full object-cover" />}
            </div>
            <div className="space-y-1 p-3">
              {s.caption && <p className="line-clamp-2 text-sm">{s.caption}</p>}
              <p className="flex items-center gap-1 text-xs font-semibold text-coral-600">
                <Clock className="h-3.5 w-3.5" aria-hidden /> {remaining(s.expiresAt, now)}
              </p>
              <Button size="sm" variant="ghost" className="-ml-3" onClick={() => setToDelete(s)} icon={<Trash2 className="h-4 w-4 text-red-500" />}>
                Excluir
              </Button>
            </div>
          </li>
        ))}
      </ul>

      {picking && (
        <Modal
          open
          onClose={() => { setPicking(false); setCreating(null); }}
          title="Novo story"
          footer={<><Button variant="ghost" onClick={() => { setPicking(false); setCreating(null); }}>Cancelar</Button><Button variant="secondary" onClick={publish} loading={saving} disabled={!creating}>Publicar por 24 horas</Button></>}
        >
          <div className="space-y-4">
            <MediaPicker kind="story" label="Foto ou vídeo" value={creating ? { url: creating.url, mediaType: creating.mediaType } : null} onUploaded={(m) => setCreating((c) => ({ ...m, caption: c?.caption ?? '' }))} />
            <Field label="Legenda">{(p) => <Input {...p} value={creating?.caption ?? ''} maxLength={200} disabled={!creating} onChange={(e) => setCreating((c) => (c ? { ...c, caption: e.target.value } : c))} placeholder="Ex.: Thor saindo cheiroso! 🐾" />}</Field>
            <p className="text-xs text-ink-500">Vídeos até 50 MB. O story some do site exatamente 24 horas após a publicação.</p>
          </div>
        </Modal>
      )}
      <ConfirmDialog open={Boolean(toDelete)} title="Excluir story?" message="O story sai do site agora e o arquivo é apagado." confirmLabel="Excluir" danger onConfirm={remove} onClose={() => setToDelete(null)} />
    </div>
  );
}
