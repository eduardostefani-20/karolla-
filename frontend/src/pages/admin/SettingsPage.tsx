import { useEffect, useState } from 'react';
import { CheckCircle2, CircleSlash, Save } from 'lucide-react';
import type { BusinessSettings } from '@karolla/shared';
import { adminApi } from '@/services/adminApi';
import { ApiError, friendlyMessage } from '@/services/api';
import { useAsync } from '@/hooks/useAsync';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { useCatalog } from '@/context/CatalogContext';
import { Alert, Spinner } from '@/components/ui/Feedback';
import { Button } from '@/components/ui/Button';
import { Field, Input, Textarea } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import { PageHeader, Panel } from '@/components/admin/AdminUi';

function StatusRow({ label, ok, detail }: { label: string; ok: boolean; detail: string }) {
  return (
    <li className="flex items-start gap-3 py-2">
      {ok ? <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" aria-hidden /> : <CircleSlash className="mt-0.5 h-5 w-5 text-ink-400" aria-hidden />}
      <div>
        <p className="font-semibold">{label}</p>
        <p className="text-sm text-ink-500">{detail}</p>
      </div>
    </li>
  );
}

export default function SettingsPage() {
  useDocumentMeta({ title: 'Configurações — Karolla Pet', noindex: true });
  const toast = useToast();
  const { reload: reloadPublic } = useCatalog();
  const { data, loading, error } = useAsync(() => adminApi.settings(), []);
  const { data: status } = useAsync(() => adminApi.systemStatus(), []);
  const [form, setForm] = useState<BusinessSettings | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  useEffect(() => setForm(data), [data]);

  if (loading && !form) return <Spinner />;
  if (error || !form) return <Alert tone="error">{error ?? 'Não foi possível carregar.'}</Alert>;
  const set = (patch: Partial<BusinessSettings>) => setForm({ ...form, ...patch });
  const numberField = (key: keyof BusinessSettings) => ({ value: String(form[key]), onChange: (e: React.ChangeEvent<HTMLInputElement>) => set({ [key]: Number(e.target.value) } as Partial<BusinessSettings>) });

  const save = async () => {
    setSaving(true);
    setErrors({});
    try {
      setForm(await adminApi.saveSettings(form));
      toast('Configurações salvas.');
      void reloadPublic();
    } catch (err) {
      if (err instanceof ApiError) setErrors(err.fields);
      toast(friendlyMessage(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader title="Configurações" description="Dados do negócio, regras da agenda e status das integrações." />
      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <Panel title="Dados da Karolla Pet">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nome" required error={errors.businessName}>{(p) => <Input {...p} value={form.businessName} onChange={(e) => set({ businessName: e.target.value })} />}</Field>
              <Field label="WhatsApp da Karolla Pet (com 55)" required error={errors.whatsappNumber} hint="Usado no site e nas mensagens. Ex.: 5511999999999">
                {(p) => <Input {...p} inputMode="tel" value={form.whatsappNumber} onChange={(e) => set({ whatsappNumber: e.target.value })} />}
              </Field>
              <Field label="E-mail de contato" error={errors.contactEmail}>{(p) => <Input {...p} type="email" value={form.contactEmail} onChange={(e) => set({ contactEmail: e.target.value })} />}</Field>
              <Field label="Instagram oficial" error={errors.instagram} hint="@ do perfil ou link (instagram.com/...). Usado no botão “Ver Instagram”; vazio = botão oculto.">{(p) => <Input {...p} placeholder="@perfil_da_karolla" value={form.instagram} onChange={(e) => set({ instagram: e.target.value })} />}</Field>
              <Field label="Endereço" error={errors.addressLine}>{(p) => <Input {...p} value={form.addressLine} onChange={(e) => set({ addressLine: e.target.value })} />}</Field>
              <Field label="Cidade" error={errors.city}>{(p) => <Input {...p} value={form.city} onChange={(e) => set({ city: e.target.value })} />}</Field>
            </div>
          </Panel>
          <Panel title="Regras da agenda">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Intervalo entre horários (min)" required error={errors.slotIntervalMinutes} hint="De quanto em quanto tempo os horários aparecem.">{(p) => <Input {...p} type="number" min={5} step={5} {...numberField('slotIntervalMinutes')} />}</Field>
              <Field label="Vagas por horário" required error={errors.capacity} hint="Pets atendidos ao mesmo tempo. Com 1, cada horário aceita um único agendamento.">{(p) => <Input {...p} type="number" min={1} {...numberField('capacity')} />}</Field>
              <Field label="Antecedência mínima (min)" required error={errors.minAdvanceMinutes} hint="Ex.: 120 = agendar com pelo menos 2h.">{(p) => <Input {...p} type="number" min={0} step={30} {...numberField('minAdvanceMinutes')} />}</Field>
              <Field label="Agenda aberta por (dias)" required error={errors.maxAdvanceDays}>{(p) => <Input {...p} type="number" min={1} {...numberField('maxAdvanceDays')} />}</Field>
            </div>
            <Field label="Aviso exibido no resumo do agendamento" className="mt-4" error={errors.bookingNotice}>{(p) => <Textarea {...p} value={form.bookingNotice} onChange={(e) => set({ bookingNotice: e.target.value })} />}</Field>
          </Panel>
          <div className="flex justify-end">
            <Button variant="secondary" size="lg" onClick={save} loading={saving} icon={<Save className="h-5 w-5" />}>
              Salvar configurações
            </Button>
          </div>
        </div>
        {status && (
          <Panel title="Integrações e ambiente">
            <ul className="divide-y divide-ink-900/5">
              <StatusRow label={`Modo: ${status.mode === 'demo' ? 'DEMONSTRAÇÃO' : 'PRODUÇÃO'}`} ok={status.mode === 'production'} detail={status.mode === 'demo' ? 'Dados fictícios em memória — reiniciar o servidor apaga tudo.' : 'Dados reais.'} />
              <StatusRow label="Banco de dados" ok={status.database.provider === 'supabase' && status.database.connected} detail={status.database.provider === 'supabase' ? (status.database.connected ? 'Supabase conectado.' : 'Supabase configurado, mas sem resposta.') : 'Em memória (demo). Supabase não conectado.'} />
              <StatusRow label="Login" ok={status.auth.provider === 'supabase'} detail={status.auth.provider === 'supabase' ? 'Supabase Auth.' : 'Autenticação de demonstração (mock).'} />
              <StatusRow label="WhatsApp" ok={status.whatsapp.provider === 'cloud_api'} detail={status.whatsapp.provider === 'cloud_api' ? 'Envio automático pela WhatsApp Cloud API.' : status.whatsapp.provider === 'link' ? 'Link wa.me com mensagem pronta (o tutor envia). Sem envio automático.' : 'Desativado.'} />
 <StatusRow label="Fotos e vídeos" ok={status.storage.provider === 'supabase'} detail={status.storage.provider === 'supabase' ? 'Supabase Storage (bucket karolla-media).' : 'Em memória (demo) — somem ao reiniciar.'} />
              <StatusRow label="Publicações do Instagram" ok={status.instagramFeed.configured} detail={status.instagramFeed.configured ? 'API oficial da Meta conectada.' : 'Não conectado (requer token da Meta — veja docs/INSTAGRAM.md). O botão “Ver Instagram” funciona sem isso.'} />
              <StatusRow label="Google Sheets" ok={status.googleSheets.configured} detail={status.googleSheets.configured ? 'Webhook configurado.' : 'Não configurado (GOOGLE_SHEETS_WEBHOOK).'} />
            </ul>
            <p className="mt-3 text-xs text-ink-400">Chaves e tokens ficam apenas nas variáveis de ambiente do servidor — veja o README.</p>
          </Panel>
        )}
      </div>
    </div>
  );
}
