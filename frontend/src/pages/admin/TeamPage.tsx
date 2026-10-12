import { useState } from 'react';
import { KeyRound, Mail, Pencil, Plus, ShieldCheck, UserRound } from 'lucide-react';
import {
  ACTION_LABELS,
  ASSIGNABLE_ROLES,
  PERMISSION_AREAS,
  ROLE_PRESETS,
  STAFF_ROLE_LABELS,
  type AgendaScope,
  type AssignableRole,
  type Permission,
  type PermissionArea,
  type PermissionAction,
  type StaffMember,
} from '@karolla/shared';
import { adminApi, teamApi } from '@/services/adminApi';
import { ApiError, friendlyMessage } from '@/services/api';
import { useAsync } from '@/hooks/useAsync';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { useAuth } from '@/context/AuthContext';
import { Alert, Badge, EmptyState, Spinner } from '@/components/ui/Feedback';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Toggle } from '@/components/ui/Toggle';
import { useToast } from '@/components/ui/Toast';
import { PageHeader, Panel } from '@/components/admin/AdminUi';
import { cn } from '@/utils/cn';

const ROLE_HELP: Record<AssignableRole | 'staff', string> = {
  staff: 'Perfil antigo: opera a agenda e vê valores, sem mexer em configurações.',
  admin: 'Acesso total ao painel, inclusive valores e equipe.',
  manager: 'Opera agenda, clientes, pets, CRM e conteúdo. Sem valores financeiros e sem gerenciar a equipe.',
  freelance: 'Vê apenas os próprios atendimentos e os pets deles. Sem valores e sem contato dos tutores.',
  professional: 'Vê os próprios atendimentos e muda o status deles. Sem valores e sem contato dos tutores.',
};

type Draft = {
  id?: string;
  /** Perfil gravado (contas antigas "staff" mantêm o perfil se não for trocado). */
  originalRole?: StaffMember['role'];
  name: string;
  email: string;
  password: string;
  role: AssignableRole | 'staff';
  professionalId: string | null;
  custom: boolean;
  grants: Permission[];
  agendaScope: AgendaScope;
};

const AREAS = Object.entries(PERMISSION_AREAS) as [PermissionArea, { label: string; actions: readonly PermissionAction[]; hint?: string }][];
const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'nunca');

/** Equipe e acessos: contas individuais, perfis e permissões personalizadas. */
export default function TeamPage() {
  useDocumentMeta({ title: 'Equipe e acessos — Karolla Pet', noindex: true });
  const toast = useToast();
  const { user, can } = useAuth();
  const manage = can('team.admin');
  const team = useAsync(() => teamApi.list(), []);
  const catalog = useAsync(() => adminApi.catalog(), []);
  const [tab, setTab] = useState<'contas' | 'auditoria'>('contas');
  const [editing, setEditing] = useState<Draft | null>(null);
  const [passwordFor, setPasswordFor] = useState<StaffMember | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const professionals = catalog.data?.professionals ?? [];
  const professionalName = (id: string | null) => professionals.find((p) => p.id === id)?.name;

  const openNew = () =>
    setEditing({ name: '', email: '', password: '', role: 'professional', professionalId: null, custom: false, grants: [...ROLE_PRESETS.professional.grants], agendaScope: 'own' });
  const openEdit = (m: StaffMember) =>
    setEditing({
      id: m.id,
      originalRole: m.role,
      name: m.name,
      email: m.email,
      password: '',
      role: m.role === 'owner' ? 'admin' : m.role,
      professionalId: m.professionalId,
      custom: Boolean(m.customPermissions),
      grants: [...m.permissions.grants],
      agendaScope: m.permissions.agendaScope,
    });

  const setRole = (role: AssignableRole | 'staff') => {
    if (!editing) return;
    // sem personalização, as permissões acompanham o perfil
    setEditing({ ...editing, role, ...(editing.custom ? {} : { grants: [...ROLE_PRESETS[role].grants], agendaScope: ROLE_PRESETS[role].agendaScope }) });
  };

  const toggleGrant = (p: Permission) => {
    if (!editing) return;
    setEditing({ ...editing, grants: editing.grants.includes(p) ? editing.grants.filter((g) => g !== p) : [...editing.grants, p] });
  };

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    setErrors({});
    const customPermissions = editing.custom ? { grants: editing.grants, agendaScope: editing.agendaScope } : null;
    try {
      if (editing.id) {
        const roleChanged = editing.role !== editing.originalRole;
        await teamApi.update(editing.id, { name: editing.name, ...(roleChanged ? { role: editing.role } : {}), professionalId: editing.professionalId, customPermissions });
        toast('Conta atualizada.');
      } else {
        if (editing.role === 'staff') throw new Error('perfil antigo');
        await teamApi.create({ name: editing.name, email: editing.email, password: editing.password, role: editing.role, professionalId: editing.professionalId, customPermissions });
        toast('Conta criada. Passe o e-mail e a senha para a pessoa — ela pode trocar a senha depois.');
      }
      setEditing(null);
      await team.reload();
    } catch (err) {
      if (err instanceof ApiError) setErrors(err.fields);
      toast(friendlyMessage(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (m: StaffMember) => {
    try {
      await teamApi.update(m.id, { active: !m.active });
      toast(m.active ? 'Conta desativada: o acesso foi encerrado.' : 'Conta reativada.');
      await team.reload();
    } catch (err) {
      toast(friendlyMessage(err), 'error');
    }
  };

  const savePassword = async () => {
    if (!passwordFor) return;
    setSaving(true);
    setErrors({});
    try {
      await teamApi.setPassword(passwordFor.id, newPassword);
      toast('Senha definida. As sessões abertas dessa conta foram encerradas.');
      setPasswordFor(null);
      setNewPassword('');
    } catch (err) {
      if (err instanceof ApiError) setErrors(err.fields);
      toast(friendlyMessage(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  const sendReset = async (m: StaffMember) => {
    try {
      await teamApi.sendReset(m.id);
      toast(`Link de redefinição enviado para ${m.email}.`);
    } catch (err) {
      toast(friendlyMessage(err), 'error');
    }
  };

  const locked = (m: StaffMember) => m.role === 'owner' || m.id === user?.id;

  return (
    <div>
      <PageHeader
        title="Equipe e acessos"
        description="Cada pessoa entra com o próprio e-mail e senha. O perfil define o que ela pode ver e fazer; você pode personalizar."
        actions={manage && tab === 'contas' ? <Button onClick={openNew} icon={<Plus className="h-4 w-4" />}>Nova conta</Button> : undefined}
      />
      {manage && (
        <div className="mb-5 flex gap-2" role="tablist" aria-label="Seções">
          {(['contas', 'auditoria'] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={cn('rounded-full px-4 py-2 text-sm font-bold', tab === t ? 'bg-brand-600 text-white' : 'bg-white text-ink-600 hover:bg-brand-50')}
            >
              {t === 'contas' ? 'Contas' : 'Registro de ações'}
            </button>
          ))}
        </div>
      )}

      {tab === 'auditoria' && manage ? (
        <AuditList />
      ) : (
        <>
          {team.loading && !team.data && <Spinner />}
          {team.error && <Alert tone="error">{team.error}</Alert>}
          {team.data && team.data.length === 0 && <EmptyState icon={<UserRound className="h-10 w-10" />} title="Nenhuma conta" />}
          {team.data && (
            <ul className="space-y-3">
              {team.data.map((m) => (
                <li key={m.id} className="card flex flex-wrap items-center gap-3 p-4" data-testid={`staff-${m.email}`}>
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-100 font-heading text-lg font-extrabold text-brand-800" aria-hidden>
                    {(m.name || m.email).slice(0, 1).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-heading text-lg font-semibold">
                      {m.name || m.email}
                      <Badge className="bg-brand-50 text-brand-800">{STAFF_ROLE_LABELS[m.role]}</Badge>
                      {m.customPermissions && <Badge className="bg-sun-100 text-ink-800">Personalizado</Badge>}
                      {!m.active && <Badge className="bg-ink-900/10 text-ink-600">Desativada</Badge>}
                    </p>
                    <p className="truncate text-sm text-ink-500">
                      {m.email}
                      {m.professionalId && ` · Profissional: ${professionalName(m.professionalId) ?? '—'}`}
                      {` · Último acesso: ${fmtDate(m.lastLoginAt)}`}
                    </p>
                  </div>
                  {manage && (
                    <div className="flex flex-wrap items-center gap-1">
                      <Toggle checked={m.active} onChange={() => toggleActive(m)} label={m.active ? 'Ativa' : 'Desativada'} disabled={locked(m)} />
                      {!locked(m) && <Button size="sm" variant="ghost" aria-label={`Editar ${m.name}`} onClick={() => openEdit(m)} icon={<Pencil className="h-4 w-4" />} />}
                      {m.role !== 'owner' && (
                        <Button size="sm" variant="ghost" aria-label={`Definir senha de ${m.name}`} onClick={() => setPasswordFor(m)} icon={<KeyRound className="h-4 w-4" />} />
                      )}
                      <Button size="sm" variant="ghost" aria-label={`Enviar link de redefinição para ${m.name}`} onClick={() => sendReset(m)} icon={<Mail className="h-4 w-4" />} />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {editing && (
        <Modal
          open
          size="lg"
          onClose={() => setEditing(null)}
          title={editing.id ? 'Editar conta' : 'Nova conta da equipe'}
          footer={
            <>
              <Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
              <Button variant="primary" onClick={save} loading={saving}>Salvar</Button>
            </>
          }
        >
          <div className="space-y-4">
            <Field label="Nome" required error={errors.name}>
              {(p) => <Input {...p} value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />}
            </Field>
            {!editing.id && (
              <>
                <Field label="E-mail (login)" required error={errors.email}>
                  {(p) => <Input {...p} type="email" autoComplete="off" value={editing.email} onChange={(e) => setEditing({ ...editing, email: e.target.value })} />}
                </Field>
                <Field label="Senha inicial" required hint="8 ou mais caracteres, com letras e números. A pessoa pode trocar depois." error={errors.password}>
                  {(p) => <Input {...p} type="password" autoComplete="new-password" value={editing.password} onChange={(e) => setEditing({ ...editing, password: e.target.value })} />}
                </Field>
              </>
            )}
            <Field label="Perfil" required hint={ROLE_HELP[editing.role]} error={errors.role}>
              {(p) => (
                <Select {...p} value={editing.role} onChange={(e) => setRole(e.target.value as AssignableRole | 'staff')}>
                  {editing.originalRole === 'staff' && <option value="staff">{STAFF_ROLE_LABELS.staff}</option>}
                  {ASSIGNABLE_ROLES.map((r) => (
                    <option key={r} value={r}>{STAFF_ROLE_LABELS[r]}</option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Profissional vinculado" hint='Usado na agenda "somente os próprios atendimentos".' error={errors.professionalId}>
              {(p) => (
                <Select {...p} value={editing.professionalId ?? ''} onChange={(e) => setEditing({ ...editing, professionalId: e.target.value || null })}>
                  <option value="">Nenhum</option>
                  {professionals.map((pr) => (
                    <option key={pr.id} value={pr.id}>{pr.name}</option>
                  ))}
                </Select>
              )}
            </Field>

            <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-ink-900/10 px-3 py-3 text-sm font-semibold">
              <input
                type="checkbox"
                className="h-5 w-5 accent-brand-600"
                checked={editing.custom}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    custom: e.target.checked,
                    ...(e.target.checked ? {} : { grants: [...ROLE_PRESETS[editing.role].grants], agendaScope: ROLE_PRESETS[editing.role].agendaScope }),
                  })
                }
              />
              Personalizar permissões desta conta
            </label>

            <fieldset disabled={!editing.custom} className={cn('space-y-3', !editing.custom && 'opacity-70')} aria-label="Permissões">
              <div className="rounded-2xl bg-lilac-50 p-3">
                <p className="mb-2 text-sm font-semibold text-ink-700">Agenda</p>
                <div className="flex flex-wrap gap-2">
                  {(['all', 'own'] as const).map((scope) => (
                    <label key={scope} className="flex cursor-pointer items-center gap-2 rounded-full bg-white px-3 py-1.5 text-sm">
                      <input type="radio" name="agendaScope" className="accent-brand-600" checked={editing.agendaScope === scope} onChange={() => setEditing({ ...editing, agendaScope: scope })} />
                      {scope === 'all' ? 'Agenda completa' : 'Somente os próprios atendimentos'}
                    </label>
                  ))}
                </div>
              </div>
              {AREAS.map(([area, def]) => (
                <div key={area} className="rounded-2xl border border-ink-900/10 p-3">
                  <p className="text-sm font-semibold text-ink-700">{def.label}</p>
                  {def.hint && <p className="text-xs text-ink-500">{def.hint}</p>}
                  <div className="mt-2 flex flex-wrap gap-2">
                    {def.actions.map((action) => {
                      const perm = `${area}.${action}` as Permission;
                      return (
                        <label key={perm} className="flex cursor-pointer items-center gap-2 rounded-full bg-lilac-50 px-3 py-1.5 text-sm">
                          <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={editing.grants.includes(perm)} onChange={() => toggleGrant(perm)} aria-label={`${def.label}: ${ACTION_LABELS[action]}`} />
                          {ACTION_LABELS[action]}
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </fieldset>
            <Alert tone="info">
              <ShieldCheck className="mr-1 inline h-4 w-4" aria-hidden /> As permissões são conferidas pelo servidor em cada ação. Sem “Valores e financeiro → Ver”, preços e totais nem chegam ao navegador da pessoa.
            </Alert>
          </div>
        </Modal>
      )}

      {passwordFor && (
        <Modal
          open
          onClose={() => setPasswordFor(null)}
          title={`Definir senha — ${passwordFor.name || passwordFor.email}`}
          footer={
            <>
              <Button variant="ghost" onClick={() => setPasswordFor(null)}>Cancelar</Button>
              <Button variant="primary" onClick={savePassword} loading={saving}>Salvar senha</Button>
            </>
          }
        >
          <Field label="Nova senha" required hint="8 ou mais caracteres, com letras e números. As sessões abertas dessa conta serão encerradas." error={errors.password}>
            {(p) => <Input {...p} type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />}
          </Field>
        </Modal>
      )}
    </div>
  );
}

function AuditList() {
  const { data, loading, error } = useAsync(() => teamApi.audit(), []);
  return (
    <Panel title="Últimas ações no painel">
      {loading && !data && <Spinner />}
      {error && <Alert tone="error">{error}</Alert>}
      {data && data.length === 0 && <p className="text-sm text-ink-500">Nenhuma ação registrada ainda.</p>}
      {data && data.length > 0 && (
        <ul className="divide-y divide-ink-900/5 text-sm">
          {data.map((log) => (
            <li key={log.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2">
              <span className="w-32 shrink-0 text-ink-500">{fmtDate(log.createdAt)}</span>
              <span className="min-w-0 flex-1 break-words font-semibold text-ink-700">{log.actorEmail || 'sistema'}</span>
              <code className="break-all rounded bg-lilac-50 px-2 py-0.5 text-xs">{log.action}</code>
              {log.entityId && <span className="break-all text-xs text-ink-400">#{log.entityId}</span>}
              {log.status >= 400 && <Badge className="bg-danger-50 text-danger-700">recusada ({log.status})</Badge>}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
