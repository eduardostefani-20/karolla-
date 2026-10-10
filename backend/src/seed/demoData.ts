import {
  addDays,
  calculateAppointmentPrice,
  DEFAULT_FORM_FIELDS,
  nowInTimezone,
  type AppointmentStatus,
  type BusinessSettings,
} from '@karolla/shared';
import type { MemoryDatabase } from '../repositories/memory/MemoryDatabase';

/**
 * ⚠️ DADOS FICTÍCIOS — MODO DEMO.
 * Clientes, pets e PREÇOS abaixo são apenas para demonstração e desenvolvimento.
 * NÃO são os preços reais da Karolla Pet. Em produção, os valores são cadastrados
 * pela administradora no painel (Preços / Adicionais) e ficam no Supabase.
 */

export function demoSettings(env: { WHATSAPP_NUMBER?: string; TIMEZONE: string }): BusinessSettings {
  return {
    businessName: 'Karolla Pet',
    whatsappNumber: env.WHATSAPP_NUMBER?.replace(/\D/g, '') ?? '',
    contactEmail: '',
    addressLine: '',
    city: '',
    instagram: '',
    timezone: env.TIMEZONE,
    slotIntervalMinutes: 30,
    capacity: 2,
    minAdvanceMinutes: 120,
    maxAdvanceDays: 60,
    bookingNotice: 'Seu horário fica reservado após a confirmação da Karolla Pet pelo WhatsApp.',
  };
}

const DOG_BREEDS: [string, string][] = [
  ['Shih Tzu', 'pequeno'], ['Yorkshire', 'mini'], ['Poodle', 'pequeno'], ['Maltês', 'mini'],
  ['Lhasa Apso', 'pequeno'], ['Spitz Alemão', 'mini'], ['Golden Retriever', 'grande'], ['Labrador', 'grande'],
  ['Border Collie', 'medio'], ['Pastor Alemão', 'grande'], ['Rottweiler', 'grande'], ['Bulldog Francês', 'pequeno'],
  ['Bulldog Inglês', 'medio'], ['Pug', 'pequeno'], ['Pinscher', 'mini'], ['Chihuahua', 'mini'],
  ['Dachshund', 'pequeno'], ['Beagle', 'medio'], ['Husky Siberiano', 'grande'], ['Chow Chow', 'medio'],
  ['Schnauzer', 'pequeno'], ['Cocker Spaniel', 'medio'], ['Akita', 'grande'], ['Samoieda', 'grande'],
  ['Bernese', 'gigante'], ['Boxer', 'grande'], ['Dálmata', 'grande'], ['Doberman', 'grande'],
  ['Fila Brasileiro', 'gigante'], ['Dogue Alemão', 'gigante'], ['São Bernardo', 'gigante'], ['Jack Russell Terrier', 'pequeno'],
  ['Bichon Frisé', 'pequeno'], ['Cavalier King Charles', 'pequeno'], ['Pitbull', 'medio'], ['Weimaraner', 'grande'],
  ['West Highland White Terrier', 'pequeno'], ['Sem raça definida (SRD)', 'medio'],
];

const CAT_BREEDS: [string, string][] = [
  ['Persa', 'pequeno'], ['Siamês', 'pequeno'], ['Maine Coon', 'medio'], ['Angorá', 'pequeno'],
  ['Ragdoll', 'medio'], ['British Shorthair', 'pequeno'], ['Sphynx', 'pequeno'], ['Bengal', 'pequeno'],
  ['Sem raça definida (SRD)', 'pequeno'],
];

const slug = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

export async function seedDemoData(db: MemoryDatabase, opts: { now: Date; timezone: string; adminEmail?: string }) {
  // Espécies
  await db.species.create({ id: 'dog', name: 'Cachorro', emoji: '🐶', active: true, sortOrder: 1 });
  await db.species.create({ id: 'cat', name: 'Gato', emoji: '🐱', active: true, sortOrder: 2 });

  // Portes
  const sizes = [
    ['mini', 'Mini', 'Até 4 kg', 0, 4],
    ['pequeno', 'Pequeno', 'De 4 a 10 kg', 4, 10],
    ['medio', 'Médio', 'De 10 a 25 kg', 10, 25],
    ['grande', 'Grande', 'De 25 a 45 kg', 25, 45],
    ['gigante', 'Gigante', 'Acima de 45 kg', 45, null],
  ] as const;
  for (const [i, [id, name, description, min, max]] of sizes.entries()) {
    await db.sizes.create({ id, name, description, minWeightKg: min, maxWeightKg: max, active: true, sortOrder: i + 1 });
  }

  // Raças
  for (const [i, [name, size]] of DOG_BREEDS.entries()) {
    await db.breeds.create({ id: `dog-${slug(name)}`, speciesId: 'dog', name, defaultSizeId: size, active: true, sortOrder: i + 1 });
  }
  for (const [i, [name, size]] of CAT_BREEDS.entries()) {
    await db.breeds.create({ id: `cat-${slug(name)}`, speciesId: 'cat', name, defaultSizeId: size, active: true, sortOrder: i + 1 });
  }

  // Serviços (sem veterinária: apenas banho, tosa e estética)
  const services = [
    ['banho', 'Banho', 'Banho completo com shampoo adequado à pelagem, secagem e escovação final.', 'Banho', 60, []],
    ['tosa', 'Tosa', 'Tosa completa no padrão da raça ou no estilo que você preferir.', 'Tosa', 90, ['dog']],
    ['tosa-higienica', 'Tosa Higiênica', 'Aparo das regiões íntimas, patas e barriga para mais conforto e higiene.', 'Tosa', 45, []],
    ['banho-tosa', 'Banho + Tosa', 'O combo completo: banho, secagem e tosa com acabamento caprichado.', 'Combo', 120, ['dog']],
    ['tosa-maquina', 'Tosa na Máquina', 'Tosa uniforme feita com máquina, prática e fresquinha.', 'Tosa', 75, ['dog']],
    ['tosa-tesoura', 'Tosa na Tesoura', 'Acabamento artesanal feito à tesoura, com mais volume e definição.', 'Tosa', 120, ['dog']],
    ['escovacao', 'Escovação', 'Escovação completa para remover pelos mortos e evitar nós.', 'Estética', 30, []],
  ] as const;
  for (const [i, [id, name, description, category, durationMinutes, speciesIds]] of services.entries()) {
    await db.services.create({ id, name, description, category, durationMinutes, active: true, sortOrder: i + 1, speciesIds: [...speciesIds] });
  }

  // ⚠️ Tabela de preços FICTÍCIA (centavos) — substituir pelos valores reais no painel.
  const demoPrices: Record<string, number[]> = {
    // mini, pequeno, medio, grande, gigante
    banho: [4500, 5500, 7000, 9000, 12000],
    tosa: [6000, 7000, 8500, 11000, 14000],
    'tosa-higienica': [3000, 3500, 4000, 5000, 6000],
    'banho-tosa': [9000, 10500, 13000, 16500, 21000],
    'tosa-maquina': [5500, 6500, 8000, 10000, 13000],
    'tosa-tesoura': [8000, 9000, 11000, 14000, 18000],
    escovacao: [2500, 3000, 3500, 4500, 5500],
  };
  const extraDuration: Record<string, number> = { grande: 15, gigante: 30 };
  for (const [serviceId, values] of Object.entries(demoPrices)) {
    for (const [i, priceCents] of values.entries()) {
      const sizeId = sizes[i]![0];
      const base = services.find((s) => s[0] === serviceId)![4];
      await db.servicePrices.create({
        id: `${serviceId}-${sizeId}`,
        serviceId,
        sizeId,
        priceCents,
        durationMinutes: extraDuration[sizeId] ? base + extraDuration[sizeId]! : null,
      });
    }
  }

  // Adicionais (preços fictícios)
  const addons = [
    ['hidratacao', 'Hidratação', 'Máscara hidratante para pelos macios e brilhantes.', 2000, 15],
    ['escovacao-especial', 'Escovação especial', 'Escovação demorada com produtos desembaraçantes.', 1500, 15],
    ['corte-unhas', 'Corte de unhas', 'Corte cuidadoso das unhas com lixamento.', 1000, 0],
    ['limpeza-ouvidos', 'Limpeza de ouvidos', 'Higienização externa dos ouvidos com produto específico.', 1000, 0],
    ['desembolo', 'Desembolo', 'Remoção cuidadosa de nós e embolos da pelagem.', 2500, 20],
    ['perfume', 'Perfume', 'Finalização com colônia pet de longa duração.', 500, 0],
    ['laco-gravata', 'Laço ou gravatinha', 'Acessório de finalização para sair ainda mais charmoso.', 500, 0],
  ] as const;
  for (const [i, [id, name, description, priceCents, durationMinutes]] of addons.entries()) {
    await db.addons.create({ id, name, description, priceCents, durationMinutes, active: true, sortOrder: i + 1 });
  }

  // Inspirações de tosa (DEMO: ilustrações estáticas em /images/inspiracoes — em produção, fotos reais enviadas no painel)
  const inspirations = [
    ['Tosa bebê', 'Pelagem curtinha e uniforme, fácil de cuidar.', 'dog', 'dog-shih-tzu', 'shih-tzu-bebe', 'tosa-maquina'],
    ['Shih Tzu com lacinho', 'Franja presa e acabamento arredondado.', 'dog', 'dog-shih-tzu', 'shih-tzu-lacinho', 'banho-tosa'],
    ['Poodle na tesoura', 'Volume e definição feitos à tesoura.', 'dog', 'dog-poodle', 'poodle-tesoura', 'tosa-tesoura'],
    ['Golden: higiênica + banho', 'Patas, barriga e regiões íntimas aparadas.', 'dog', 'dog-golden-retriever', 'golden-higienica', 'tosa-higienica'],
    ['Yorkshire clássico', 'Tosa no padrão da raça com laço.', 'dog', 'dog-yorkshire', 'yorkshire-classica', 'tosa'],
    ['Spitz "leãozinho"', 'Corpo curto, juba e cauda preservadas.', 'dog', 'dog-spitz-alemao', 'spitz-leao', 'tosa-tesoura'],
    ['Persa escovado', 'Escovação completa e higiênica.', 'cat', 'cat-persa', 'persa-escovacao', 'escovacao'],
  ] as const;
  for (const [i, [title, description, speciesId, breedId, file, serviceId]] of inspirations.entries()) {
    const breed = await db.breeds.findById(breedId);
    await db.inspirations.create({
      id: `demo-${file}`,
      title,
      description,
      speciesId,
      breedId,
      breedName: breed?.name ?? '',
      imageUrl: `/images/inspiracoes/${file}.svg`,
      storagePath: '',
      serviceId,
      active: true,
      sortOrder: i + 1,
    });
  }
  await db.stories.create({
    mediaType: 'image',
    mediaUrl: '/images/inspiracoes/shih-tzu-lacinho.svg',
    storagePath: '',
    caption: 'Mel saindo cheirosa hoje! 🎀 (exemplo)',
    expiresAt: new Date(opts.now.getTime() + 24 * 3_600_000).toISOString(),
  });

  // Horário de funcionamento (exemplo editável no painel)
  for (let weekday = 0; weekday <= 6; weekday++) {
    await db.businessHours.create({
      id: `hours-${weekday}`,
      weekday,
      isOpen: weekday !== 0,
      openTime: '08:00',
      closeTime: weekday === 6 ? '14:00' : '18:00',
      breakStart: weekday === 6 ? null : '12:00',
      breakEnd: weekday === 6 ? null : '13:00',
    });
  }

  await db.formFields.upsertMany(Object.values(DEFAULT_FORM_FIELDS));

  if (opts.adminEmail) {
    db.addAdmin({ userId: 'demo-admin', email: opts.adminEmail, name: 'Carol (demo)', role: 'owner', active: true });
  }

  // Clientes e pets fictícios
  const empty = { street: '', number: '', complement: '', neighborhood: '', city: '' };
  const joao = await db.customers.create({
    name: 'João Silva (demo)', whatsapp: '11988887777', email: 'joao.demo@exemplo.com',
    address: { street: 'Rua das Flores', number: '120', complement: '', neighborhood: 'Centro', city: 'São Paulo' }, notes: '',
  });
  const maria = await db.customers.create({
    name: 'Maria Souza (demo)', whatsapp: '11977776666', email: 'maria.demo@exemplo.com',
    address: { street: 'Av. Brasil', number: '45', complement: 'Apto 12', neighborhood: 'Jardins', city: 'São Paulo' }, notes: 'Prefere contato à tarde.',
  });
  const ana = await db.customers.create({
    name: 'Ana Lima (demo)', whatsapp: '11966665555', email: '', address: empty, notes: '',
  });

  const thor = await db.pets.create({ customerId: joao.id, name: 'Thor', speciesId: 'dog', breedId: 'dog-golden-retriever', breedName: 'Golden Retriever', sizeId: 'grande', weightKg: 32, ageMonths: 48, notes: 'Adora água.' });
  const mel = await db.pets.create({ customerId: maria.id, name: 'Mel', speciesId: 'dog', breedId: 'dog-shih-tzu', breedName: 'Shih Tzu', sizeId: 'pequeno', weightKg: 6, ageMonths: 30, notes: 'Sensível ao secador.' });
  const luna = await db.pets.create({ customerId: maria.id, name: 'Luna', speciesId: 'dog', breedId: 'dog-poodle', breedName: 'Poodle', sizeId: 'pequeno', weightKg: 7, ageMonths: 18, notes: '' });
  const nina = await db.pets.create({ customerId: ana.id, name: 'Nina', speciesId: 'cat', breedId: 'cat-persa', breedName: 'Persa', sizeId: 'pequeno', weightKg: 4, ageMonths: 60, notes: 'Gata tranquila.' });

  // Agendamentos fictícios ao redor de hoje
  const today = nowInTimezone(opts.now, opts.timezone).date;
  const catalog = {
    services: await db.services.list(),
    servicePrices: await db.servicePrices.list(),
    addons: await db.addons.list(),
    sizes: await db.sizes.list(),
  };
  const book = async (
    pet: typeof thor,
    dayOffset: number,
    time: string,
    serviceIds: string[],
    addonIds: string[],
    status: AppointmentStatus,
  ) => {
    const price = calculateAppointmentPrice({ serviceIds, sizeId: pet.sizeId, addonIds }, catalog);
    await db.appointments.create(
      {
        customerId: pet.customerId,
        petId: pet.id,
        sizeId: pet.sizeId,
        date: addDays(today, dayOffset),
        time,
        durationMinutes: price.totalDurationMinutes,
        totalCents: price.totalCents,
        status,
        notes: '',
        customerNotes: '',
        source: 'online',
        professionalId: null,
        inspiration: null,
        services: price.lines.filter((l) => l.kind === 'service').map((l) => ({ serviceId: l.refId, name: l.name, priceCents: l.priceCents, durationMinutes: l.durationMinutes })),
        addons: price.lines.filter((l) => l.kind === 'addon').map((l) => ({ addonId: l.refId, name: l.name, priceCents: l.priceCents, durationMinutes: l.durationMinutes })),
      },
      { capacity: 99 },
    );
  };
  await book(thor, -14, '10:00', ['banho'], ['corte-unhas'], 'completed');
  await book(mel, -7, '09:00', ['banho-tosa'], [], 'completed');
  await book(thor, 0, '08:00', ['banho-tosa'], ['hidratacao'], 'confirmed');
  await book(mel, 0, '09:30', ['banho'], [], 'pending');
  await book(luna, 0, '11:00', ['tosa'], [], 'confirmed');
  await book(nina, 1, '14:00', ['banho'], ['escovacao-especial'], 'pending');
  await book(luna, 3, '15:00', ['banho'], ['perfume'], 'pending');
}
