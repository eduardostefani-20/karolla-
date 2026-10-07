-- =============================================================================
-- KAROLLA PET — Seed 0002: tabela de preços DE DEMONSTRAÇÃO
-- Gerado por backend/scripts/generate-seed-sql.ts (não editar à mão).
-- ⚠️ VALORES FICTÍCIOS. NÃO são os preços reais da Karolla Pet. Ajuste no painel → Preços.
-- =============================================================================

insert into public.service_prices (id, service_id, size_id, price_cents, duration_minutes) values
  ('banho-mini', 'banho', 'mini', 4500, null),
  ('banho-pequeno', 'banho', 'pequeno', 5500, null),
  ('banho-medio', 'banho', 'medio', 7000, null),
  ('banho-grande', 'banho', 'grande', 9000, 75),
  ('banho-gigante', 'banho', 'gigante', 12000, 90),
  ('tosa-mini', 'tosa', 'mini', 6000, null),
  ('tosa-pequeno', 'tosa', 'pequeno', 7000, null),
  ('tosa-medio', 'tosa', 'medio', 8500, null),
  ('tosa-grande', 'tosa', 'grande', 11000, 105),
  ('tosa-gigante', 'tosa', 'gigante', 14000, 120),
  ('tosa-higienica-mini', 'tosa-higienica', 'mini', 3000, null),
  ('tosa-higienica-pequeno', 'tosa-higienica', 'pequeno', 3500, null),
  ('tosa-higienica-medio', 'tosa-higienica', 'medio', 4000, null),
  ('tosa-higienica-grande', 'tosa-higienica', 'grande', 5000, 60),
  ('tosa-higienica-gigante', 'tosa-higienica', 'gigante', 6000, 75),
  ('banho-tosa-mini', 'banho-tosa', 'mini', 9000, null),
  ('banho-tosa-pequeno', 'banho-tosa', 'pequeno', 10500, null),
  ('banho-tosa-medio', 'banho-tosa', 'medio', 13000, null),
  ('banho-tosa-grande', 'banho-tosa', 'grande', 16500, 135),
  ('banho-tosa-gigante', 'banho-tosa', 'gigante', 21000, 150),
  ('tosa-maquina-mini', 'tosa-maquina', 'mini', 5500, null),
  ('tosa-maquina-pequeno', 'tosa-maquina', 'pequeno', 6500, null),
  ('tosa-maquina-medio', 'tosa-maquina', 'medio', 8000, null),
  ('tosa-maquina-grande', 'tosa-maquina', 'grande', 10000, 90),
  ('tosa-maquina-gigante', 'tosa-maquina', 'gigante', 13000, 105),
  ('tosa-tesoura-mini', 'tosa-tesoura', 'mini', 8000, null),
  ('tosa-tesoura-pequeno', 'tosa-tesoura', 'pequeno', 9000, null),
  ('tosa-tesoura-medio', 'tosa-tesoura', 'medio', 11000, null),
  ('tosa-tesoura-grande', 'tosa-tesoura', 'grande', 14000, 135),
  ('tosa-tesoura-gigante', 'tosa-tesoura', 'gigante', 18000, 150),
  ('escovacao-mini', 'escovacao', 'mini', 2500, null),
  ('escovacao-pequeno', 'escovacao', 'pequeno', 3000, null),
  ('escovacao-medio', 'escovacao', 'medio', 3500, null),
  ('escovacao-grande', 'escovacao', 'grande', 4500, 45),
  ('escovacao-gigante', 'escovacao', 'gigante', 5500, 60)
on conflict (id) do nothing;

