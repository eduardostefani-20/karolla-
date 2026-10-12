import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Link2, MessageCircle, Pencil } from 'lucide-react';
import { buildWhatsAppLink, CONTACT_KIND_LABELS, CONTACT_STATUS_LABELS, formatAge, formatPhone, type CustomerDetail } from '@karolla/shared';
import { adminApi } from '@/services/adminApi';
import { useAsync } from '@/hooks/useAsync';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { Alert, Spinner } from '@/components/ui/Feedback';
import { Button, ExternalButton } from '@/components/ui/Button';
import { PageHeader, Panel } from '@/components/admin/AdminUi';
import { AppointmentHistory } from '@/components/admin/AppointmentHistory';
import { EditCustomerModal } from '@/components/admin/EditCustomerModal';
import { ContactButton } from '@/components/admin/ContactButton';
import { Field, Input } from '@/components/ui/Field';
import { Toggle } from '@/components/ui/Toggle';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/context/AuthContext';
import { friendlyMessage } from '@/services/api';

export default function CustomerDetailPage() {
  const { id = '' } = useParams();
  useDocumentMeta({ title: 'Cliente — Karolla Pet', noindex: true });
  const { data: c, loading, error, reload, setData } = useAsync(() => adminApi.customer(id), [id]);
  const [editing, setEditing] = useState(false);
  const { can } = useAuth();
  const toast = useToast();
  if (loading && !c) return <Spinner />;
  if (error || !c) return <Alert tone="error">{error ?? 'Cliente não encontrado.'}</Alert>;
  const petNames = Object.fromEntries(c.pets.map((p) => [p.id, p.name]));

  return (
    <div>
      <Link to="/admin/clientes" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-ink-500 hover:text-ink-800">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Clientes
      </Link>
      <PageHeader
        title={c.name}
        description={`Cliente desde ${new Date(c.createdAt).toLocaleDateString('pt-BR')}`}
        actions={
          <>
            {can('customers.edit') && <Button variant="outline" size="sm" icon={<Pencil className="h-4 w-4" />} onClick={() => setEditing(true)}>Editar</Button>}
            {can('crm.edit') ? (
              <ContactButton customerId={c.id} kind="other" label="WhatsApp" onDone={() => void reload()} />
            ) : (
              <ExternalButton href={buildWhatsAppLink(c.whatsapp)} variant="whatsapp" size="sm" icon={<MessageCircle className="h-4 w-4" aria-hidden />}>WhatsApp</ExternalButton>
            )}
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <div className="space-y-6">
          <Panel title="Dados pessoais">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
              <dt className="text-ink-500">WhatsApp</dt><dd>{formatPhone(c.whatsapp)}</dd>
              <dt className="text-ink-500">E-mail</dt><dd className="break-all">{c.email || '—'}</dd>
              <dt className="text-ink-500">Endereço</dt>
              <dd>{[c.address.street && `${c.address.street}, ${c.address.number}`, c.address.complement, c.address.neighborhood, c.address.city].filter(Boolean).join(' — ') || '—'}</dd>
              <dt className="text-ink-500">Obs. internas</dt><dd className="whitespace-pre-wrap">{c.notes || '—'}</dd>
            </dl>
            <p className="mt-2 text-xs text-ink-400">As observações internas só aparecem para a equipe.</p>
            {can('customers.edit') && (
              <Toggle
                className="mt-4"
                checked={c.marketingOptOut}
                label="Não quer receber mensagens de lembrete/promoção"
                description="O CRM não oferece convite de reativação para este cliente."
                onChange={async (v) => {
                  try {
                    await adminApi.updateCustomer(c.id, { marketingOptOut: v });
                    setData({ ...c, marketingOptOut: v });
                  } catch (err) {
                    toast(friendlyMessage(err), 'error');
                  }
                }}
              />
            )}
          </Panel>
          <AccountPanel c={c} canEdit={can('customers.edit')} onChange={setData} />
          {c.contacts.length > 0 && (
            <Panel title="Contatos pelo WhatsApp">
              <ul className="space-y-2 text-sm">
                {c.contacts.map((k) => (
                  <li key={k.id} className="rounded-2xl bg-lilac-50 px-3 py-2">
                    <p className="flex flex-wrap justify-between gap-2 font-semibold">
                      <span>{CONTACT_KIND_LABELS[k.kind]}</span>
                      <span className={k.status === 'sent' ? 'text-leaf-700' : 'text-ink-500'}>{CONTACT_STATUS_LABELS[k.status]}</span>
                    </p>
                    <p className="text-xs text-ink-500">{new Date(k.createdAt).toLocaleString('pt-BR')} • {k.actorName}</p>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
          <Panel title={`Pets (${c.pets.length})`}>
            <ul className="space-y-2">
              {c.pets.map((p) => (
                <li key={p.id}>
                  <Link to={`/admin/pets/${p.id}`} className="block rounded-2xl border border-ink-900/5 px-4 py-3 hover:border-brand-200 hover:bg-brand-50">
                    <p className="font-heading text-lg font-semibold">{p.name}</p>
                    <p className="text-sm text-ink-500">{[p.breedName, p.weightKg != null && `${p.weightKg} kg`, formatAge(p.ageMonths)].filter(Boolean).join(' • ')}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
        <Panel title="Histórico de agendamentos">
          <AppointmentHistory items={c.appointments} petNames={petNames} />
        </Panel>
      </div>
      {editing && <EditCustomerModal open customer={c} onClose={() => setEditing(false)} onSaved={() => void reload()} />}
    </div>
  );
}

/** Conta do portal do cliente: ligada ou não, e vínculo manual pelo e-mail do login. */
function AccountPanel({ c, canEdit, onChange }: { c: CustomerDetail; canEdit: boolean; onChange: (c: CustomerDetail) => void }) {
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<CustomerDetail>, ok: string) => {
    setBusy(true);
    try {
      onChange(await fn());
      toast(ok);
      setEmail('');
    } catch (err) {
      toast(friendlyMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Panel title={<span className="flex items-center gap-2"><Link2 className="h-5 w-5 text-brand-600" aria-hidden /> Conta no site</span>}>
      {c.accountEmail ? (
        <div className="space-y-3 text-sm">
          <p>Ligada ao login <strong className="break-all">{c.accountEmail}</strong>. O cliente vê os próprios pets e agendamentos em “Minha conta”.</p>
          {canEdit && (
            <Button size="sm" variant="ghost" loading={busy} onClick={() => run(() => adminApi.unlinkAccount(c.id), 'Vínculo desfeito.')}>
              Desfazer vínculo
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3 text-sm">
          <p className="text-ink-600">Sem conta ligada. Se o cliente criou a conta com outro e-mail, confirme que é a mesma pessoa e ligue aqui.</p>
          {canEdit && (
            <div className="flex flex-wrap items-end gap-2">
              <Field label="E-mail do login do cliente" className="min-w-0 flex-1">
                {(p) => <Input {...p} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />}
              </Field>
              <Button size="sm" loading={busy} disabled={!email} onClick={() => run(() => adminApi.linkAccount(c.id, email), 'Conta ligada ao cadastro.')}>
                Ligar conta
              </Button>
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}
