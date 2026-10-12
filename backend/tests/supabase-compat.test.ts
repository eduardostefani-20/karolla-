import { describe, expect, it, vi } from 'vitest';
import { PET_DEFAULTS, CUSTOMER_DEFAULTS } from '@karolla/shared';

/**
 * Banco de produção ANTES da migração 0009: colunas/tabelas novas não existem.
 * O servidor deve continuar gravando pets/clientes/configurações (sem os campos novos) e
 * os recursos novos devem ficar "em ativação" em vez de quebrar.
 */
const NEW_COLUMNS = ['birth_date', 'characteristics', 'grooming_preferences', 'internal_notes', 'photo_path', 'marketing_opt_out', 'crm_inactive_days', 'crm_reactivation_message'];
const NEW_TABLES = ['pet_references', 'contact_logs'];
const writes: { table: string; row: Record<string, unknown> }[] = [];

function builder(table: string) {
  let row: Record<string, unknown> | null = null;
  let selectCols = '*';
  const result = () => {
    if (NEW_TABLES.includes(table)) return { data: null, error: { code: 'PGRST205', message: `Could not find the table 'public.${table}'` } };
    if (row && Object.keys(row).some((k) => NEW_COLUMNS.includes(k))) {
      return { data: null, error: { code: 'PGRST204', message: "Could not find the column in the schema cache" } };
    }
    if (NEW_COLUMNS.some((c) => selectCols.includes(c))) return { data: null, error: { code: '42703', message: 'column does not exist' } };
    if (row) writes.push({ table, row });
    return { data: { id: 'x1', ...(row ?? {}), created_at: '2026-10-12', updated_at: '2026-10-12' }, error: null };
  };
  const b: Record<string, unknown> = {};
  const chain = () => b;
  Object.assign(b, {
    insert: (r: Record<string, unknown>) => ((row = r), b),
    update: (r: Record<string, unknown>) => ((row = r), b),
    select: (cols = '*') => ((selectCols = cols), b),
    eq: chain,
    match: chain,
    order: chain,
    limit: chain,
    single: async () => result(),
    maybeSingle: async () => result(),
    then: (resolve: (v: unknown) => void) => {
      const r = result();
      resolve(r.error ? r : { data: [], error: null });
    },
  });
  return b;
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: (table: string) => builder(table), storage: { from: () => ({}) } }),
}));

describe('Compatibilidade com o banco antes da migração 0009', () => {
  it('grava pet e cliente sem as colunas novas e lê listas novas como vazias', async () => {
    const { SupabaseDatabase } = await import('../src/repositories/supabase/SupabaseDatabase');
    const db = new SupabaseDatabase('https://x.supabase.co', 'service');
    writes.length = 0;
    await db.pets.create({ ...PET_DEFAULTS, customerId: 'c1', name: 'Bob', speciesId: 'dog', breedId: null, breedName: 'SRD', sizeId: 'p', weightKg: null, ageMonths: null, notes: '' });
    await db.customers.create({ ...CUSTOMER_DEFAULTS, name: 'Ana', whatsapp: '11999999999', email: '', address: { street: '', number: '', complement: '', neighborhood: '', city: '' }, notes: '' });
    expect(writes.map((w) => w.table)).toEqual(['pets', 'customers']);
    for (const w of writes) expect(Object.keys(w.row).some((k) => NEW_COLUMNS.includes(k))).toBe(false);
    expect(await db.contacts.list({ customerId: 'c1' })).toEqual([]);
    expect(await db.petReferences.list({ petId: 'p1' })).toEqual([]);
    expect(await db.featuresReady()).toBe(false);
  });

  it('salvar configurações funciona sem as colunas do CRM', async () => {
    const { SupabaseDatabase } = await import('../src/repositories/supabase/SupabaseDatabase');
    const db = new SupabaseDatabase('https://x.supabase.co', 'service');
    writes.length = 0;
    await db.settings.update({ businessName: 'Karolla Pet', crmInactiveDays: 40 });
    expect(writes).toEqual([{ table: 'business_settings', row: { business_name: 'Karolla Pet' } }]);
  });
});
