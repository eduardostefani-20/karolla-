import { useEffect, useMemo, useState } from 'react';
import { Save } from 'lucide-react';
import { formatCents } from '@karolla/shared';
import { adminApi } from '@/services/adminApi';
import { friendlyMessage } from '@/services/api';
import { useAsync } from '@/hooks/useAsync';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { useCatalog } from '@/context/CatalogContext';
import { Alert, Badge, Spinner } from '@/components/ui/Feedback';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { PageHeader } from '@/components/admin/AdminUi';
import { MoneyInput } from '@/components/admin/MoneyInput';

type Matrix = Record<string, number | null>; // chave: serviceId|sizeId
const key = (serviceId: string, sizeId: string) => `${serviceId}|${sizeId}`;

/** Tabela simples de preços: um valor por serviço e porte. Sem tocar em código. */
export default function PricesPage() {
  useDocumentMeta({ title: 'Preços — Karolla Pet', noindex: true });
  const toast = useToast();
  const { reload: reloadPublic, catalog: publicCatalog } = useCatalog();
  const { data, loading, error, reload } = useAsync(() => adminApi.catalog(), []);
  const [values, setValues] = useState<Matrix>({});
  const [saving, setSaving] = useState(false);

  const original = useMemo(() => {
    const m: Matrix = {};
    data?.services.forEach((s) => data.sizes.forEach((z) => (m[key(s.id, z.id)] = data.servicePrices.find((p) => p.serviceId === s.id && p.sizeId === z.id)?.priceCents ?? null)));
    return m;
  }, [data]);
  useEffect(() => setValues(original), [original]);

  const changed = Object.keys(values).filter((k) => values[k] !== original[k]);

  const save = async () => {
    if (!data) return;
    setSaving(true);
    try {
      await adminApi.savePrices(
        changed.map((k) => {
          const [serviceId, sizeId] = k.split('|') as [string, string];
          const existing = data.servicePrices.find((p) => p.serviceId === serviceId && p.sizeId === sizeId);
          return { serviceId, sizeId, priceCents: values[k] ?? null, durationMinutes: existing?.durationMinutes ?? null };
        }),
      );
      toast('Preços salvos! O site já mostra os novos valores.');
      await reload();
      void reloadPublic();
    } catch (err) {
      toast(friendlyMessage(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="pb-24">
      <PageHeader title="Preços" description="Defina o valor de cada serviço por porte. Deixe em branco se o serviço não é oferecido para aquele porte." />
      {publicCatalog?.mode === 'demo' && (
        <Alert tone="warning" className="mb-5">Os valores atuais são fictícios (modo demonstração). Substitua pelos preços reais da Karolla Pet.</Alert>
      )}
      {loading && !data && <Spinner />}
      {error && <Alert tone="error">{error}</Alert>}
      {data && (
        <div className="space-y-4">
          {data.services.map((s) => (
            <section key={s.id} className="card p-5" aria-labelledby={`preco-${s.id}`}>
              <div className="mb-3 flex items-center gap-2">
                <h2 id={`preco-${s.id}`} className="font-display text-lg font-semibold uppercase tracking-wide">{s.name}</h2>
                {!s.active && <Badge className="bg-ink-900/10 text-ink-600">Inativo</Badge>}
              </div>
              <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-5">
                {data.sizes.map((z) => {
                  const k = key(s.id, z.id);
                  const id = `p-${s.id}-${z.id}`;
                  return (
                    <div key={z.id} className="flex items-center justify-between gap-3 lg:flex-col lg:items-stretch lg:gap-1">
                      <label htmlFor={id} className="text-sm font-semibold text-ink-600">
                        {z.name}
                        {!z.active && <span className="text-xs text-ink-400"> (inativo)</span>}
                      </label>
                      <MoneyInput id={id} className="w-36 lg:w-full" value={values[k] ?? null} onChange={(v) => setValues((m) => ({ ...m, [k]: v }))} aria-label={`Preço de ${s.name} porte ${z.name}`} />
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-ink-900/5 bg-white/95 px-4 py-3 backdrop-blur lg:left-[260px]">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <p className="text-sm text-ink-500" aria-live="polite">
            {changed.length ? `${changed.length} alteração(ões) não salva(s)` : 'Tudo salvo'}
            {changed.length > 0 && (
              <span className="hidden sm:inline">
                {' '}— ex.: {changed[0] && data?.services.find((s) => s.id === changed[0]!.split('|')[0])?.name} {formatCents(values[changed[0]!] ?? 0)}
              </span>
            )}
          </p>
          <Button variant="secondary" size="lg" onClick={save} loading={saving} disabled={!changed.length} icon={<Save className="h-5 w-5" />}>
            Salvar alterações
          </Button>
        </div>
      </div>
    </div>
  );
}
