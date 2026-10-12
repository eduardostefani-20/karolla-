import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { CalendarHeart, LogOut, PawPrint, Plus } from 'lucide-react';
import {
  APPOINTMENT_STATUS_LABELS,
  buildWhatsAppLink,
  formatAge,
  formatCents,
  formatDateBR,
  formatPhone,
  SUBSCRIPTION_STATUS_LABELS,
  type PortalCustomer,
} from '@karolla/shared';
import { useCustomerAuth } from '@/context/CustomerAuthContext';
import { useCatalog } from '@/context/CatalogContext';
import { useAsync } from '@/hooks/useAsync';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { accountApi } from '@/services/accountApi';
import { ApiError, friendlyMessage } from '@/services/api';
import { Button, ButtonLink, ExternalButton } from '@/components/ui/Button';
import { Alert, EmptyState, Spinner } from '@/components/ui/Feedback';
import { Field, Input } from '@/components/ui/Field';
import { Toggle } from '@/components/ui/Toggle';
import { useToast } from '@/components/ui/Toast';
import { PetFormModal } from '@/components/account/PetFormModal';

/** Área do cliente: pets, histórico e dados pessoais. */
export default function AccountPage() {
  useDocumentMeta({ title: 'Minha conta — Karolla Pet', noindex: true });
  const { status, account, logout } = useCustomerAuth();
  const { catalog } = useCatalog();
  if (status === 'checking') return <Spinner className="min-h-[50vh]" />;
  if (status !== 'authenticated' || !account) return <Navigate to="/minha-conta/entrar" replace />;

  const whatsapp = catalog?.settings.whatsappNumber;
  return (
    <div className="container-page space-y-8 py-10 sm:py-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-brand-700">Minha conta</p>
          <h1 className="text-3xl font-extrabold text-ink-900">Olá, {account.name.split(' ')[0] || 'tutor'}!</h1>
          <p className="text-sm text-ink-500">{account.email}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink to="/agendar" variant="accent" icon={<CalendarHeart className="h-4 w-4" aria-hidden />}>Agendar</ButtonLink>
          <Button variant="ghost" onClick={logout} icon={<LogOut className="h-4 w-4" aria-hidden />}>Sair</Button>
        </div>
      </div>

      {account.status === 'pending' || !account.customer ? (
        <Alert tone="warning" title="Falta só confirmar seu cadastro">
          <p>
            Sua conta foi criada, mas não conseguimos ligá-la automaticamente ao seu cadastro na Karolla Pet (por segurança, ligamos
            sozinhos apenas quando o e-mail é o mesmo dos seus agendamentos).
          </p>
          {whatsapp && (
            <ExternalButton
              href={buildWhatsAppLink(whatsapp, `Oi! Criei minha conta no site com o e-mail ${account.email}. Podem liberar meu acesso?`)}
              variant="whatsapp"
              size="sm"
              className="mt-3"
            >
              Falar no WhatsApp
            </ExternalButton>
          )}
        </Alert>
      ) : (
        <>
          <PetsSection />
          <PlansSection />
          <HistorySection />
          <ProfileSection customer={account.customer} />
        </>
      )}
    </div>
  );
}

function PetsSection() {
  const toast = useToast();
  const { catalog } = useCatalog();
  const { data, loading, error, reload } = useAsync(() => accountApi.pets(), []);
  const [adding, setAdding] = useState(false);
  return (
    <section aria-labelledby="meus-pets" className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 id="meus-pets" className="text-2xl font-extrabold text-ink-900">Meus pets</h2>
        <Button size="sm" onClick={() => setAdding(true)} icon={<Plus className="h-4 w-4" aria-hidden />}>Adicionar pet</Button>
      </div>
      {loading && !data && <Spinner />}
      {error && <Alert tone="error">{error}</Alert>}
      {data && data.length === 0 && <EmptyState icon={<PawPrint className="h-10 w-10" />} title="Nenhum pet cadastrado ainda" />}
      {data && data.length > 0 && (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((p) => (
            <li key={p.id}>
              <Link to={`/minha-conta/pets/${p.id}`} className="card flex items-center gap-4 p-4 transition-shadow hover:shadow-lift" data-testid={`portal-pet-${p.name}`}>
                {p.photoUrl ? (
                  <img src={p.photoUrl} alt="" className="h-16 w-16 shrink-0 rounded-full object-cover" />
                ) : (
                  <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-brand-100 text-2xl" aria-hidden>
                    {catalog?.species.find((s) => s.id === p.speciesId)?.emoji ?? '🐾'}
                  </span>
                )}
                <span className="min-w-0">
                  <span className="block truncate text-lg font-extrabold text-ink-900">{p.name}</span>
                  <span className="block truncate text-sm text-ink-500">
                    {p.breedName}
                    {p.ageMonths != null && ` • ${formatAge(p.ageMonths)}`}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {adding && (
        <PetFormModal
          pet={null}
          onClose={() => setAdding(false)}
          onSave={async (body) => {
            await accountApi.createPet(body);
            toast('Pet cadastrado!');
            await reload();
          }}
        />
      )}
    </section>
  );
}

function PlansSection() {
  const { data } = useAsync(() => accountApi.plans().catch(() => []), []);
  if (!data || data.length === 0) return null;
  return (
    <section aria-labelledby="meus-planos" className="space-y-4">
      <h2 id="meus-planos" className="text-2xl font-extrabold text-ink-900">Meus planos</h2>
      <ul className="grid gap-3 sm:grid-cols-2">
        {data.map((p) => (
          <li key={p.id} className="card p-4">
            <p className="text-lg font-extrabold text-ink-900">{p.plan.name}{p.petName ? ` • ${p.petName}` : ''}</p>
            <p className="text-sm font-semibold text-brand-700">{SUBSCRIPTION_STATUS_LABELS[p.effectiveStatus]}</p>
            <p className="mt-1 text-sm text-ink-600">
              {p.effectiveStatus === 'active' && `${p.usesLeft} de ${p.plan.usesPerPeriod} uso(s) disponíveis até ${formatDateBR(p.nextDueDate)}`}
              {p.effectiveStatus === 'overdue' && `Venceu em ${formatDateBR(p.nextDueDate)}. Fale com a Karolla Pet para regularizar.`}
              {p.effectiveStatus === 'pending' && 'Aguardando o primeiro pagamento.'}
            </p>
            {p.plan.rules && <p className="mt-2 text-xs text-ink-500">{p.plan.rules}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}

function HistorySection() {
  const { data, loading, error } = useAsync(() => accountApi.appointments(), []);
  return (
    <section aria-labelledby="historico" className="space-y-4">
      <h2 id="historico" className="text-2xl font-extrabold text-ink-900">Meus agendamentos</h2>
      {loading && !data && <Spinner />}
      {error && <Alert tone="error">{error}</Alert>}
      {data && data.length === 0 && <p className="text-ink-600">Você ainda não tem agendamentos.</p>}
      {data && data.length > 0 && (
        <ul className="card divide-y divide-ink-900/5">
          {data.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 p-4 text-sm">
              <span className="w-28 shrink-0 font-bold text-ink-900">{formatDateBR(a.date)} {a.time}</span>
              <span className="min-w-0 flex-1">
                <strong>{a.petName}</strong> • {a.services.map((s) => s.name).join(' + ')}
                {a.addons.length > 0 && <span className="text-ink-500"> + {a.addons.map((s) => s.name).join(', ')}</span>}
              </span>
              <span className="tabular-nums text-ink-700">{formatCents(a.totalCents)}</span>
              <span className="rounded-pill bg-lilac-50 px-3 py-1 text-xs font-bold text-brand-800">{APPOINTMENT_STATUS_LABELS[a.status]}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ProfileSection({ customer }: { customer: PortalCustomer }) {
  const toast = useToast();
  const { reload } = useCustomerAuth();
  const [form, setForm] = useState({ ...customer, whatsapp: formatPhone(customer.whatsapp) });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const setAddress = (patch: Partial<PortalCustomer['address']>) => setForm((f) => ({ ...f, address: { ...f.address, ...patch } }));

  const save = async () => {
    setSaving(true);
    setErrors({});
    try {
      await accountApi.updateProfile({ name: form.name, whatsapp: form.whatsapp, address: form.address, marketingOptOut: form.marketingOptOut });
      await reload();
      toast('Dados atualizados.');
    } catch (err) {
      if (err instanceof ApiError) setErrors(err.fields);
      toast(friendlyMessage(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  const changeEmail = async () => {
    try {
      await accountApi.changeEmail(newEmail);
      toast('Enviamos um link de confirmação para o novo e-mail. A troca vale depois de confirmar.');
      setNewEmail('');
    } catch (err) {
      toast(friendlyMessage(err), 'error');
    }
  };

  return (
    <section aria-labelledby="meus-dados" className="space-y-4">
      <h2 id="meus-dados" className="text-2xl font-extrabold text-ink-900">Meus dados</h2>
      <div className="card grid gap-4 p-5 sm:grid-cols-2">
        <Field label="Nome" required error={errors.name}>
          {(p) => <Input {...p} autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />}
        </Field>
        <Field label="WhatsApp" required error={errors.whatsapp}>
          {(p) => <Input {...p} type="tel" inputMode="tel" value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} />}
        </Field>
        <Field label="Rua" error={errors['address.street']}>
          {(p) => <Input {...p} autoComplete="address-line1" value={form.address.street} onChange={(e) => setAddress({ street: e.target.value })} />}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Número" error={errors['address.number']}>
            {(p) => <Input {...p} value={form.address.number} onChange={(e) => setAddress({ number: e.target.value })} />}
          </Field>
          <Field label="Complemento">
            {(p) => <Input {...p} value={form.address.complement} onChange={(e) => setAddress({ complement: e.target.value })} />}
          </Field>
        </div>
        <Field label="Bairro">
          {(p) => <Input {...p} value={form.address.neighborhood} onChange={(e) => setAddress({ neighborhood: e.target.value })} />}
        </Field>
        <Field label="Cidade">
          {(p) => <Input {...p} autoComplete="address-level2" value={form.address.city} onChange={(e) => setAddress({ city: e.target.value })} />}
        </Field>
        <div className="sm:col-span-2">
          <Toggle
            checked={form.marketingOptOut}
            onChange={(v) => setForm({ ...form, marketingOptOut: v })}
            label="Não quero receber lembretes nem promoções pelo WhatsApp"
          />
        </div>
        <div className="sm:col-span-2">
          <Button variant="primary" onClick={save} loading={saving}>Salvar dados</Button>
        </div>
      </div>
      <div className="card flex flex-wrap items-end gap-3 p-5">
        <Field label="Trocar e-mail" hint="Enviaremos um link de confirmação para o novo endereço." className="min-w-0 flex-1">
          {(p) => <Input {...p} type="email" inputMode="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="novo@email.com" />}
        </Field>
        <Button variant="outline" onClick={changeEmail} disabled={!newEmail}>Trocar e-mail</Button>
      </div>
    </section>
  );
}
