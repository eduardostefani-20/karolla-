/**
 * Permissões da equipe (painel administrativo).
 *
 * Cada usuário tem um PERFIL (que define permissões iniciais) e pode ter permissões PERSONALIZADAS
 * pela administradora principal. O servidor sempre valida as permissões — esconder menus na tela
 * é apenas conveniência.
 */

export const STAFF_ROLES = ['owner', 'admin', 'manager', 'freelance', 'professional', 'staff'] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const STAFF_ROLE_LABELS: Record<StaffRole, string> = {
  owner: 'Administradora principal',
  admin: 'Administrador',
  manager: 'Gerente',
  freelance: 'Freelance',
  professional: 'Profissional',
  staff: 'Equipe (antigo)',
};

/** Perfis que a administradora pode atribuir (a conta principal é única e não é criada pelo painel). */
export const ASSIGNABLE_ROLES = ['admin', 'manager', 'freelance', 'professional'] as const;
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

export const PERMISSION_ACTIONS = ['view', 'create', 'edit', 'delete', 'confirm', 'admin'] as const;
export type PermissionAction = (typeof PERMISSION_ACTIONS)[number];

export const ACTION_LABELS: Record<PermissionAction, string> = {
  view: 'Ver',
  create: 'Criar',
  edit: 'Editar',
  delete: 'Excluir',
  confirm: 'Confirmar',
  admin: 'Administrar',
};

/** Áreas do sistema e as ações que fazem sentido em cada uma. */
export const PERMISSION_AREAS = {
  dashboard: { label: 'Dashboard', actions: ['view'] },
  agenda: { label: 'Agenda e agendamentos', actions: ['view', 'create', 'edit', 'delete', 'confirm'], hint: '"Confirmar" = mudar o status do atendimento.' },
  customers: { label: 'Clientes (contato e endereço)', actions: ['view', 'create', 'edit', 'delete'] },
  pets: { label: 'Animais', actions: ['view', 'create', 'edit', 'delete'] },
  crm: { label: 'CRM (inativos e contatos)', actions: ['view', 'edit'] },
  services: { label: 'Serviços, adicionais e formulário', actions: ['view', 'create', 'edit', 'delete'] },
  finance: { label: 'Valores e financeiro', actions: ['view', 'edit'], hint: 'Preços, totais, receitas e mensalidades. Sem "Ver", os valores nem chegam ao navegador.' },
  professionals: { label: 'Profissionais', actions: ['view', 'create', 'edit', 'delete'] },
  inspirations: { label: 'Inspirações e Stories', actions: ['view', 'create', 'edit', 'delete'] },
  comments: { label: 'Comentários', actions: ['view', 'delete'] },
  plans: { label: 'Planos e mensalidades', actions: ['view', 'create', 'edit', 'delete', 'confirm'], hint: '"Confirmar" = registrar pagamento.' },
  taxidog: { label: 'Taxi Dog', actions: ['view', 'create', 'edit', 'delete'] },
  settings: { label: 'Configurações e horários', actions: ['view', 'edit'] },
  team: { label: 'Equipe e permissões', actions: ['view', 'admin'] },
} as const satisfies Record<string, { label: string; actions: readonly PermissionAction[]; hint?: string }>;

export type PermissionArea = keyof typeof PERMISSION_AREAS;
export type Permission = `${PermissionArea}.${PermissionAction}`;

export const ALL_PERMISSIONS: Permission[] = (Object.entries(PERMISSION_AREAS) as [PermissionArea, { actions: readonly PermissionAction[] }][]).flatMap(
  ([area, def]) => def.actions.map((a) => `${area}.${a}` as Permission),
);

export type AgendaScope = 'all' | 'own';

/** Permissões efetivas de um usuário. */
export interface PermissionSet {
  grants: Permission[];
  /** 'own' = vê e mexe só nos atendimentos do profissional vinculado à conta. */
  agendaScope: AgendaScope;
}

const all = (area: PermissionArea): Permission[] => PERMISSION_AREAS[area].actions.map((a) => `${area}.${a}` as Permission);

export const ROLE_PRESETS: Record<StaffRole, PermissionSet> = {
  owner: { grants: [...ALL_PERMISSIONS], agendaScope: 'all' },
  admin: { grants: [...ALL_PERMISSIONS], agendaScope: 'all' },
  manager: {
    grants: [
      'dashboard.view',
      ...all('agenda'),
      'customers.view', 'customers.create', 'customers.edit',
      'pets.view', 'pets.create', 'pets.edit',
      ...all('crm'),
      'services.view',
      'professionals.view',
      'inspirations.view', 'inspirations.create', 'inspirations.edit',
      ...all('comments'),
      'plans.view',
      'taxidog.view', 'taxidog.create', 'taxidog.edit',
      'settings.view',
    ],
    agendaScope: 'all',
  },
  freelance: { grants: ['agenda.view', 'pets.view'], agendaScope: 'own' },
  professional: { grants: ['agenda.view', 'agenda.confirm', 'pets.view'], agendaScope: 'own' },
  // perfil antigo "staff": operava a agenda sem acessar configurações
  staff: {
    grants: ['dashboard.view', ...all('agenda'), 'customers.view', 'customers.edit', 'pets.view', 'pets.edit', 'services.view', 'professionals.view', 'inspirations.view', 'settings.view', 'finance.view'],
    agendaScope: 'all',
  },
};

const KNOWN = new Set<string>(ALL_PERMISSIONS);

/** Limpa uma lista vinda do banco/requisição: só permissões conhecidas, sem repetição. */
export function sanitizeGrants(grants: readonly string[]): Permission[] {
  return [...new Set(grants.filter((g) => KNOWN.has(g)))] as Permission[];
}

/**
 * Permissões efetivas: a conta principal tem tudo, sempre; os demais usam a personalização
 * (quando existir) ou o perfil.
 */
export function resolvePermissions(role: StaffRole, custom: PermissionSet | null | undefined): PermissionSet {
  if (role === 'owner') return ROLE_PRESETS.owner;
  if (!custom) return ROLE_PRESETS[role] ?? { grants: [], agendaScope: 'own' };
  return { grants: sanitizeGrants(custom.grants), agendaScope: custom.agendaScope === 'own' ? 'own' : 'all' };
}

export function hasPermission(set: Pick<PermissionSet, 'grants'> | null | undefined, permission: Permission): boolean {
  return Boolean(set?.grants.includes(permission));
}

/**
 * Campos com valores financeiros. Para quem não tem "finance.view", o servidor remove esses campos
 * de TODAS as respostas do painel antes de enviar ao navegador.
 */
export const FINANCE_FIELDS = [
  'totalCents',
  'priceCents',
  'revenueCents',
  'revenueTodayCents',
  'expectedTotalCents',
  'servicePrices',
  'amountCents',
  'feeCents',
  'feeOneWayCents',
  'feeRoundTripCents',
  'monthlyPriceCents',
  'paidCents',
  'balanceCents',
] as const;

/** Remove recursivamente os campos financeiros de um objeto (cópia; o original não é alterado). */
export function redactFinance<T>(value: T): T {
  const strip = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(strip);
    if (v && typeof v === 'object' && !(v instanceof Date)) {
      const out: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
        if ((FINANCE_FIELDS as readonly string[]).includes(k)) continue;
        out[k] = strip(val);
      }
      return out;
    }
    return v;
  };
  return strip(value) as T;
}
