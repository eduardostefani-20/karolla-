-- =============================================================================
-- KAROLLA PET — Seed 0001: catálogo inicial (editável pelo painel)
-- Gerado por backend/scripts/generate-seed-sql.ts (não editar à mão).
-- =============================================================================

insert into public.pet_species (id, name, emoji, active, sort_order) values
  ('dog', 'Cachorro', '🐶', true, 1),
  ('cat', 'Gato', '🐱', true, 2)
on conflict (id) do nothing;

insert into public.pet_sizes (id, name, description, min_weight_kg, max_weight_kg, active, sort_order) values
  ('mini', 'Mini', 'Até 4 kg', 0, 4, true, 1),
  ('pequeno', 'Pequeno', 'De 4 a 10 kg', 4, 10, true, 2),
  ('medio', 'Médio', 'De 10 a 25 kg', 10, 25, true, 3),
  ('grande', 'Grande', 'De 25 a 45 kg', 25, 45, true, 4),
  ('gigante', 'Gigante', 'Acima de 45 kg', 45, null, true, 5)
on conflict (id) do nothing;

insert into public.pet_breeds (id, species_id, name, default_size_id, active, sort_order) values
  ('dog-shih-tzu', 'dog', 'Shih Tzu', 'pequeno', true, 1),
  ('cat-persa', 'cat', 'Persa', 'pequeno', true, 1),
  ('dog-yorkshire', 'dog', 'Yorkshire', 'mini', true, 2),
  ('cat-siames', 'cat', 'Siamês', 'pequeno', true, 2),
  ('dog-poodle', 'dog', 'Poodle', 'pequeno', true, 3),
  ('cat-maine-coon', 'cat', 'Maine Coon', 'medio', true, 3),
  ('dog-maltes', 'dog', 'Maltês', 'mini', true, 4),
  ('cat-angora', 'cat', 'Angorá', 'pequeno', true, 4),
  ('dog-lhasa-apso', 'dog', 'Lhasa Apso', 'pequeno', true, 5),
  ('cat-ragdoll', 'cat', 'Ragdoll', 'medio', true, 5),
  ('dog-spitz-alemao', 'dog', 'Spitz Alemão', 'mini', true, 6),
  ('cat-british-shorthair', 'cat', 'British Shorthair', 'pequeno', true, 6),
  ('dog-golden-retriever', 'dog', 'Golden Retriever', 'grande', true, 7),
  ('cat-sphynx', 'cat', 'Sphynx', 'pequeno', true, 7),
  ('dog-labrador', 'dog', 'Labrador', 'grande', true, 8),
  ('cat-bengal', 'cat', 'Bengal', 'pequeno', true, 8),
  ('dog-border-collie', 'dog', 'Border Collie', 'medio', true, 9),
  ('cat-sem-raca-definida-srd', 'cat', 'Sem raça definida (SRD)', 'pequeno', true, 9),
  ('dog-pastor-alemao', 'dog', 'Pastor Alemão', 'grande', true, 10),
  ('dog-rottweiler', 'dog', 'Rottweiler', 'grande', true, 11),
  ('dog-bulldog-frances', 'dog', 'Bulldog Francês', 'pequeno', true, 12),
  ('dog-bulldog-ingles', 'dog', 'Bulldog Inglês', 'medio', true, 13),
  ('dog-pug', 'dog', 'Pug', 'pequeno', true, 14),
  ('dog-pinscher', 'dog', 'Pinscher', 'mini', true, 15),
  ('dog-chihuahua', 'dog', 'Chihuahua', 'mini', true, 16),
  ('dog-dachshund', 'dog', 'Dachshund', 'pequeno', true, 17),
  ('dog-beagle', 'dog', 'Beagle', 'medio', true, 18),
  ('dog-husky-siberiano', 'dog', 'Husky Siberiano', 'grande', true, 19),
  ('dog-chow-chow', 'dog', 'Chow Chow', 'medio', true, 20),
  ('dog-schnauzer', 'dog', 'Schnauzer', 'pequeno', true, 21),
  ('dog-cocker-spaniel', 'dog', 'Cocker Spaniel', 'medio', true, 22),
  ('dog-akita', 'dog', 'Akita', 'grande', true, 23),
  ('dog-samoieda', 'dog', 'Samoieda', 'grande', true, 24),
  ('dog-bernese', 'dog', 'Bernese', 'gigante', true, 25),
  ('dog-boxer', 'dog', 'Boxer', 'grande', true, 26),
  ('dog-dalmata', 'dog', 'Dálmata', 'grande', true, 27),
  ('dog-doberman', 'dog', 'Doberman', 'grande', true, 28),
  ('dog-fila-brasileiro', 'dog', 'Fila Brasileiro', 'gigante', true, 29),
  ('dog-dogue-alemao', 'dog', 'Dogue Alemão', 'gigante', true, 30),
  ('dog-sao-bernardo', 'dog', 'São Bernardo', 'gigante', true, 31),
  ('dog-jack-russell-terrier', 'dog', 'Jack Russell Terrier', 'pequeno', true, 32),
  ('dog-bichon-frise', 'dog', 'Bichon Frisé', 'pequeno', true, 33),
  ('dog-cavalier-king-charles', 'dog', 'Cavalier King Charles', 'pequeno', true, 34),
  ('dog-pitbull', 'dog', 'Pitbull', 'medio', true, 35),
  ('dog-weimaraner', 'dog', 'Weimaraner', 'grande', true, 36),
  ('dog-west-highland-white-terrier', 'dog', 'West Highland White Terrier', 'pequeno', true, 37),
  ('dog-sem-raca-definida-srd', 'dog', 'Sem raça definida (SRD)', 'medio', true, 38)
on conflict (id) do nothing;

insert into public.services (id, name, description, category, duration_minutes, active, sort_order, species_ids) values
  ('banho', 'Banho', 'Banho completo com shampoo adequado à pelagem, secagem e escovação final.', 'Banho', 60, true, 1, array[]::text[]),
  ('tosa', 'Tosa', 'Tosa completa no padrão da raça ou no estilo que você preferir.', 'Tosa', 90, true, 2, array['dog']::text[]),
  ('tosa-higienica', 'Tosa Higiênica', 'Aparo das regiões íntimas, patas e barriga para mais conforto e higiene.', 'Tosa', 45, true, 3, array[]::text[]),
  ('banho-tosa', 'Banho + Tosa', 'O combo completo: banho, secagem e tosa com acabamento caprichado.', 'Combo', 120, true, 4, array['dog']::text[]),
  ('tosa-maquina', 'Tosa na Máquina', 'Tosa uniforme feita com máquina, prática e fresquinha.', 'Tosa', 75, true, 5, array['dog']::text[]),
  ('tosa-tesoura', 'Tosa na Tesoura', 'Acabamento artesanal feito à tesoura, com mais volume e definição.', 'Tosa', 120, true, 6, array['dog']::text[]),
  ('escovacao', 'Escovação', 'Escovação completa para remover pelos mortos e evitar nós.', 'Estética', 30, true, 7, array[]::text[])
on conflict (id) do nothing;

insert into public.addons (id, name, description, price_cents, duration_minutes, active, sort_order) values
  ('hidratacao', 'Hidratação', 'Máscara hidratante para pelos macios e brilhantes.', 2000, 15, true, 1),
  ('escovacao-especial', 'Escovação especial', 'Escovação demorada com produtos desembaraçantes.', 1500, 15, true, 2),
  ('corte-unhas', 'Corte de unhas', 'Corte cuidadoso das unhas com lixamento.', 1000, 0, true, 3),
  ('limpeza-ouvidos', 'Limpeza de ouvidos', 'Higienização externa dos ouvidos com produto específico.', 1000, 0, true, 4),
  ('desembolo', 'Desembolo', 'Remoção cuidadosa de nós e embolos da pelagem.', 2500, 20, true, 5),
  ('perfume', 'Perfume', 'Finalização com colônia pet de longa duração.', 500, 0, true, 6),
  ('laco-gravata', 'Laço ou gravatinha', 'Acessório de finalização para sair ainda mais charmoso.', 500, 0, true, 7)
on conflict (id) do nothing;

insert into public.business_hours (id, weekday, is_open, open_time, close_time, break_start, break_end) values
  ('hours-0', 0, false, '08:00', '18:00', '12:00', '13:00'),
  ('hours-1', 1, true, '08:00', '18:00', '12:00', '13:00'),
  ('hours-2', 2, true, '08:00', '18:00', '12:00', '13:00'),
  ('hours-3', 3, true, '08:00', '18:00', '12:00', '13:00'),
  ('hours-4', 4, true, '08:00', '18:00', '12:00', '13:00'),
  ('hours-5', 5, true, '08:00', '18:00', '12:00', '13:00'),
  ('hours-6', 6, true, '08:00', '14:00', null, null)
on conflict (id) do nothing;

insert into public.form_options (key, label, help_text, enabled, required, sort_order) values
  ('pet.weight', 'Peso aproximado (kg)', 'Ajuda a confirmar o porte do pet.', true, false, 1),
  ('pet.age', 'Idade', '', true, false, 2),
  ('pet.notes', 'Observações sobre o pet', 'Alergias, comportamento, sensibilidade ao secador...', true, false, 3),
  ('tutor.email', 'E-mail', '', true, true, 4),
  ('tutor.address', 'Endereço', 'Usado para cadastro e, futuramente, leva e traz.', true, true, 5),
  ('tutor.notes', 'Observações para a equipe', '', true, false, 6)
on conflict (key) do nothing;

update public.business_settings set
  business_name = 'Karolla Pet',
  whatsapp_number = '',
  contact_email = '',
  address_line = '',
  city = '',
  instagram = '',
  timezone = 'America/Sao_Paulo',
  slot_interval_minutes = 30,
  capacity = 2,
  min_advance_minutes = 120,
  max_advance_days = 60,
  booking_notice = 'Seu horário fica reservado após a confirmação da Karolla Pet pelo WhatsApp.'
where id = 1;

-- Configure o número real da Karolla Pet no painel (Configurações) ou:
-- update public.business_settings set whatsapp_number = '55DDDNUMERO' where id = 1;
