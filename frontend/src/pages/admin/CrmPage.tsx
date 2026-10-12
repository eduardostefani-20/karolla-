import { useState } from 'react';
import { Link } from 'react-router-dom';
import { HeartHandshake, Search } from 'lucide-react';
import { CONTACT_STATUS_LABELS, formatDateBR, formatPhone, type CrmCustomer, type CrmSegment } from '@karolla/shared';
import { adminApi } from '@/services/adminApi';
import { useAsync } from '@/hooks/useAsync';
import { useDebounce } from '@/hooks/useDebounce';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { useAuth } from '@/context/AuthContext';
import { Alert, Badge, EmptyState, Spinner } from '@/components/ui/Feedback';
import { Input } from '@/components/ui/Field';
import { PageHeader } from '@/components/admin/AdminUi';
import { ContactButton } from '@/components/admin/ContactButton';
import { cn } from '@/utils/cn';

const SEGMENTS: { key: 'all' | CrmSegment; label: string }[] = [
  { key: 'inactive', label: 'Inativos' },
  { key: 'recurring', label: 'Recorrentes' },
  { key: 'new', label: 'Novos' },
  { key: 'all', label: 'Todos' },
];

const SEGMENT_BADGE: Record<CrmSegment, string> = {
  inactive: 'bg-sun-100 text-ink-800',
  recurring: 'bg-leaf-50 text-leaf-800',
  new: 'bg-brand-50 text-brand-800',
};
const SEGMENT_LABEL: Record<CrmSegment, string> = { inactive: 'Inativo', recurring: 'Recorrente', new: 'Novo' };

/** CRM: quem está sumido, quem é recorrente, e contato pelo WhatsApp (sem envio automático). */
export default function CrmPage() {
  useDocumentMeta({ title: 'CRM — Karolla Pet', noindex: true });
  const { can } = useAuth();
  const [segment, setSegment] = useState<'all' | CrmSegment>('inactive');
  const [search, setSearch] = useState('');
  const q = useDebounce(search);
  const { data, loading, error, reload } = useAsync(() => adminApi.crm({ segment, search: q || undefined }), [segment, q]);

  return (
    <div>
      <PageHeader
        title="CRM"
        description={
          data
            ? `Inativo = sem atendimento concluído há mais de ${data.inactiveDays} dias e sem horário marcado (ajuste em Configurações). Nenhuma mensagem é enviada automaticamente.`
            : 'Clientes novos, recorrentes e inativos.'
        }
      />
      <div className="mb-5 flex flex-wrap items-center gap-2" role="tablist" aria-label="Grupos de clientes">
        {SEGMENTS.map((s) => (
          <button
            key={s.key}
            type="button"
            role="tab"
            aria-selected={segment === s.key}
            onClick={() => setSegment(s.key)}
            className={cn('rounded-full px-4 py-2 text-sm font-bold', segment === s.key ? 'bg-brand-600 text-white' : 'bg-white text-ink-600 hover:bg-brand-50')}
          >
            {s.label}
            {data && s.key !== 'all' && <span className="ml-1 opacity-80">({data.counts[s.key]})</span>}
          </button>
        ))}
        <label className="relative ml-auto block w-full sm:w-72">
          <span className="sr-only">Buscar no CRM</span>
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" aria-hidden />
          <Input className="py-2.5 pl-10" placeholder="Nome, pet, WhatsApp" value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
      </div>
      {loading && !data && <Spinner />}
      {error && <Alert tone="error">{error}</Alert>}
      {data && data.customers.length === 0 && <EmptyState icon={<HeartHandshake className="h-10 w-10" />} title="Ninguém neste grupo" />}
      {data && data.customers.length > 0 && (
        <ul className="space-y-3">
          {data.customers.map((c) => (
            <CrmRow key={c.id} c={c} canContact={can('crm.edit')} onChanged={() => void reload()} />
          ))}
        </ul>
      )}
    </div>
  );
}

function CrmRow({ c, canContact, onChanged }: { c: CrmCustomer; canContact: boolean; onChanged: () => void }) {
  return (
    <li className="card flex flex-wrap items-center gap-3 p-4" data-testid={`crm-${c.name}`}>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 font-heading text-lg font-semibold">
          <Link to={`/admin/clientes/${c.id}`} className="hover:underline">{c.name}</Link>
          <Badge className={SEGMENT_BADGE[c.segment]}>{SEGMENT_LABEL[c.segment]}</Badge>
          {c.marketingOptOut && <Badge className="bg-ink-900/10 text-ink-600">Não quer mensagens</Badge>}
          {c.hasAccount && <Badge className="bg-lilac-50 text-brand-800">Tem conta no site</Badge>}
        </p>
        <p className="text-sm text-ink-500">
          {formatPhone(c.whatsapp)}
          {c.pets.length > 0 && ` • ${c.pets.map((p) => p.name).join(', ')}`}
        </p>
        <p className="text-sm text-ink-600">
          {c.visits} atendimento(s) concluído(s)
          {c.lastVisit && ` • último em ${formatDateBR(c.lastVisit)} (${c.daysSinceLastVisit} dias)`}
          {c.nextAppointment && ` • próximo: ${formatDateBR(c.nextAppointment)}`}
        </p>
        {c.lastContact && (
          <p className="text-xs text-ink-400">
            Último contato: {new Date(c.lastContact.createdAt).toLocaleDateString('pt-BR')} por {c.lastContact.actorName} — {CONTACT_STATUS_LABELS[c.lastContact.status]}
          </p>
        )}
      </div>
      {canContact && (
        <ContactButton
          customerId={c.id}
          kind={c.segment === 'inactive' ? 'reactivation' : 'other'}
          label={c.segment === 'inactive' ? 'Convidar a voltar' : 'Chamar no WhatsApp'}
          disabled={c.segment === 'inactive' && c.marketingOptOut}
          disabledReason="O cliente pediu para não receber mensagens."
          onDone={onChanged}
        />
      )}
    </li>
  );
}
