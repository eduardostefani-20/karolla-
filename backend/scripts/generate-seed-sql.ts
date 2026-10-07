/**
 * Gera database/seed/*.sql a partir dos MESMOS dados usados no modo DEMO,
 * garantindo que o banco Supabase e o modo demo comecem idênticos.
 *
 *   npm run db:seed-sql --workspace backend
 *
 * Saída:
 *   database/seed/0001_catalog.sql      espécies, portes, raças, serviços, adicionais, horários, formulário
 *   database/seed/0002_demo_prices.sql  ⚠️ preços FICTÍCIOS de demonstração
 *   database/seed/0003_demo_customers.sql ⚠️ clientes/pets/agendamentos FICTÍCIOS (opcional)
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { MemoryDatabase } from '../src/repositories/memory/MemoryDatabase';
import { demoSettings, seedDemoData } from '../src/seed/demoData';
import {
  addonMapping,
  appointmentToRow,
  breedMapping,
  businessHoursMapping,
  customerMapping,
  formFieldToRow,
  petMapping,
  serviceMapping,
  servicePriceMapping,
  settingsToRow,
  sizeMapping,
  speciesMapping,
  type Row,
} from '../src/repositories/supabase/mappers';

const literal = (v: unknown): string => {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (Array.isArray(v)) return `array[${v.map(literal).join(', ')}]::text[]`;
  return `'${String(v).replace(/'/g, "''")}'`;
};

function insert(table: string, rows: Row[], conflict = 'id'): string {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]!);
  const values = rows.map((r) => `  (${cols.map((c) => literal(r[c])).join(', ')})`).join(',\n');
  return `insert into public.${table} (${cols.join(', ')}) values\n${values}\non conflict (${conflict}) do nothing;\n\n`;
}

const header = (title: string, warning?: string) =>
  `-- =============================================================================\n-- KAROLLA PET — ${title}\n-- Gerado por backend/scripts/generate-seed-sql.ts (não editar à mão).\n${warning ? `-- ${warning}\n` : ''}-- =============================================================================\n\n`;

async function main() {
  const db = new MemoryDatabase(demoSettings({ TIMEZONE: 'America/Sao_Paulo' }));
  // data fixa → seed reprodutível
  await seedDemoData(db, { now: new Date('2026-10-07T13:00:00Z'), timezone: 'America/Sao_Paulo' });
  const out = resolve(import.meta.dirname, '../../database/seed');

  const settings = await db.settings.get();
  const settingsRow = settingsToRow({ ...settings, whatsappNumber: '' });
  const catalog =
    header('Seed 0001: catálogo inicial (editável pelo painel)') +
    insert('pet_species', (await db.species.list()).map((x) => speciesMapping.toRow(x))) +
    insert('pet_sizes', (await db.sizes.list()).map((x) => sizeMapping.toRow(x))) +
    insert('pet_breeds', (await db.breeds.list()).map((x) => breedMapping.toRow(x))) +
    insert('services', (await db.services.list()).map((x) => serviceMapping.toRow(x))) +
    insert('addons', (await db.addons.list()).map((x) => addonMapping.toRow(x))) +
    insert('business_hours', (await db.businessHours.list()).map((x) => businessHoursMapping.toRow(x))) +
    insert('form_options', (await db.formFields.list()).map((f, i) => ({ ...formFieldToRow(f), sort_order: i + 1 })), 'key') +
    `update public.business_settings set\n${Object.entries(settingsRow)
      .map(([k, v]) => `  ${k} = ${literal(v)}`)
      .join(',\n')}\nwhere id = 1;\n\n-- Configure o número real da Karolla Pet no painel (Configurações) ou:\n-- update public.business_settings set whatsapp_number = '55DDDNUMERO' where id = 1;\n`;

  const prices =
    header('Seed 0002: tabela de preços DE DEMONSTRAÇÃO', '⚠️ VALORES FICTÍCIOS. NÃO são os preços reais da Karolla Pet. Ajuste no painel → Preços.') +
    insert('service_prices', (await db.servicePrices.list()).map((x) => servicePriceMapping.toRow(x)));

  // Clientes demo: IDs determinísticos para o SQL
  const customers = await db.customers.list();
  const pets = await db.pets.list();
  const uuid = (prefix: string, i: number) => `00000000-0000-4000-8000-${prefix}${String(i).padStart(12 - prefix.length, '0')}`;
  const customerIds = new Map(customers.map((c, i) => [c.id, uuid('c', i + 1)]));
  const petIds = new Map(pets.map((p, i) => [p.id, uuid('d', i + 1)]));
  const appointments = await db.appointments.list();
  let demo = header('Seed 0003: clientes, pets e agendamentos FICTÍCIOS (opcional)', '⚠️ DADOS DE DEMONSTRAÇÃO. Não executar em produção com clientes reais.');
  demo += insert('customers', customers.map((c) => ({ ...customerMapping.toRow({ ...c, createdAt: undefined, updatedAt: undefined }), id: customerIds.get(c.id) })));
  demo += insert('pets', pets.map((p) => ({ ...petMapping.toRow(p), id: petIds.get(p.id), customer_id: customerIds.get(p.customerId) })));
  demo += '-- Agendamentos relativos à data de execução (hoje, ontem, próximos dias)\n';
  for (const [i, a] of appointments.entries()) {
    const id = uuid('a', i + 1);
    const offset = Math.round((Date.parse(a.date) - Date.parse('2026-10-07')) / 86_400_000);
    const row = { ...appointmentToRow(a), id, customer_id: customerIds.get(a.customerId), pet_id: petIds.get(a.petId) };
    const cols = Object.keys(row).filter((c) => c !== 'date');
    demo += `insert into public.appointments (${cols.join(', ')}, date) values (${cols.map((c) => literal((row as Row)[c])).join(', ')}, (now() at time zone 'America/Sao_Paulo')::date + ${offset}) on conflict (id) do nothing;\n`;
    for (const [pos, s] of a.services.entries()) {
      demo += `insert into public.appointment_services (appointment_id, service_id, name, price_cents, duration_minutes, position) select ${literal(id)}, ${literal(s.serviceId)}, ${literal(s.name)}, ${s.priceCents}, ${s.durationMinutes}, ${pos} where not exists (select 1 from public.appointment_services where appointment_id = ${literal(id)} and position = ${pos});\n`;
    }
    for (const [pos, s] of a.addons.entries()) {
      demo += `insert into public.appointment_addons (appointment_id, addon_id, name, price_cents, duration_minutes, position) select ${literal(id)}, ${literal(s.addonId)}, ${literal(s.name)}, ${s.priceCents}, ${s.durationMinutes}, ${pos} where not exists (select 1 from public.appointment_addons where appointment_id = ${literal(id)} and position = ${pos});\n`;
    }
  }

  writeFileSync(resolve(out, '0001_catalog.sql'), catalog);
  writeFileSync(resolve(out, '0002_demo_prices.sql'), prices);
  writeFileSync(resolve(out, '0003_demo_customers.sql'), demo);
  console.log(`Seeds gerados em ${out}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
