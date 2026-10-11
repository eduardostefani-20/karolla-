-- =============================================================================
-- Karolla Pet — 0007: cor padrão de profissional na paleta KarollaPet
-- Antes: '#279790' (verde-água da identidade antiga). Agora: '#6A1FA0' (roxo da marca).
-- Só muda o valor padrão de novos registros; cores já escolhidas não são alteradas.
-- =============================================================================
alter table public.professionals alter column color set default '#6A1FA0';
