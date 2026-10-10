import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Heart, Search, Sparkles, X } from 'lucide-react';
import { publicApi } from '@/services/publicApi';
import { useAsync } from '@/hooks/useAsync';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { useFavorites } from '@/hooks/useFavorites';
import { useCatalog } from '@/context/CatalogContext';
import { Alert, EmptyState, Spinner } from '@/components/ui/Feedback';
import { Input } from '@/components/ui/Field';
import { InspirationGrid } from '@/components/inspirations/InspirationGrid';
import { InspirationViewer } from '@/components/inspirations/InspirationViewer';
import { InstagramButton } from '@/components/inspirations/InstagramButton';
import { InstagramFeed } from '@/components/inspirations/InstagramFeed';
import { StoriesBar } from '@/components/stories/StoriesBar';
import { cn } from '@/utils/cn';

const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** Catálogo de inspirações de tosa, organizado por raça (visual inspirado no Instagram). */
export default function InspirationsPage() {
  useDocumentMeta({
    title: 'Inspirações de tosa por raça — Karolla Pet',
    description: 'Veja fotos de tosas por raça, salve suas favoritas e agende o visual escolhido para o seu pet na Karolla Pet.',
  });
  const { catalog } = useCatalog();
  const { data, loading, error, reload } = useAsync(() => publicApi.inspirations(), []);
  const { isFavorite, toggle, ids: favoriteIds } = useFavorites();
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState(params.get('raca') ?? '');
  const [species, setSpecies] = useState<string>('');
  const [onlyFavorites, setOnlyFavorites] = useState(false);

  const all = data ?? [];
  const items = useMemo(() => {
    const q = normalize(query);
    return all.filter(
      (i) =>
        (!species || i.speciesId === species) &&
        (!q || normalize(i.breedName).includes(q) || normalize(i.title).includes(q)) &&
        (!onlyFavorites || favoriteIds.includes(i.id)),
    );
  }, [all, query, species, onlyFavorites, favoriteIds]);

  const breeds = useMemo(() => [...new Set(all.filter((i) => !species || i.speciesId === species).map((i) => i.breedName))].sort((a, b) => a.localeCompare(b, 'pt-BR')), [all, species]);
  const speciesWithPhotos = catalog?.species.filter((s) => all.some((i) => i.speciesId === s.id)) ?? [];

  // Foto aberta fica na URL (?foto=id): o link compartilhado abre direto nela
  const openId = params.get('foto');
  const openIndex = openId ? items.findIndex((i) => i.id === openId) : -1;
  const setOpen = useCallback(
    (id: string | null) => {
      const next = new URLSearchParams(params);
      if (id) next.set('foto', id);
      else next.delete('foto');
      setParams(next, { replace: Boolean(id && openId) });
    },
    [params, setParams, openId],
  );

  return (
    <div className="container-page py-8 sm:py-12">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="eyebrow">
            <Sparkles className="h-3.5 w-3.5" aria-hidden /> Inspirações
          </span>
          <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">Escolha o visual do seu pet</h1>
          <p className="mt-2 max-w-xl text-ink-500">Toque numa foto para ampliar, salve suas favoritas e agende com o visual escolhido.</p>
        </div>
        <InstagramButton />
      </div>

      <StoriesBar className="mb-6" />

      <div className="sticky top-[72px] z-20 -mx-4 mb-5 space-y-3 bg-cream-100/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:bg-transparent sm:p-0">
        <label className="relative block">
          <span className="sr-only">Buscar por raça</span>
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" aria-hidden />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por raça (ex.: Shih Tzu, Poodle...)" className="py-2.5 pl-10 pr-10" list="racas-inspiracoes" />
          {query && (
            <button type="button" onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-ink-400 hover:bg-ink-900/5" aria-label="Limpar busca">
              <X className="h-4 w-4" />
            </button>
          )}
          <datalist id="racas-inspiracoes">{breeds.map((b) => <option key={b} value={b} />)}</datalist>
        </label>
        <div className="scroll-thin -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
          {[{ id: '', label: 'Todos' }, ...speciesWithPhotos.map((s) => ({ id: s.id, label: `${s.emoji} ${s.name}` }))].map((s) => (
            <button
              key={s.id || 'all'}
              type="button"
              aria-pressed={species === s.id}
              onClick={() => setSpecies(s.id)}
              className={cn('shrink-0 rounded-full px-4 py-2 text-sm font-semibold', species === s.id ? 'bg-brand-600 text-white' : 'bg-white text-ink-600 shadow-card')}
            >
              {s.label}
            </button>
          ))}
          <button
            type="button"
            aria-pressed={onlyFavorites}
            onClick={() => setOnlyFavorites((v) => !v)}
            className={cn('inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold', onlyFavorites ? 'bg-coral-500 text-white' : 'bg-white text-ink-600 shadow-card')}
          >
            <Heart className={cn('h-4 w-4', onlyFavorites && 'fill-current')} aria-hidden /> Favoritas ({favoriteIds.filter((id) => all.some((i) => i.id === id)).length})
          </button>
          {breeds.slice(0, 12).map((b) => (
            <button key={b} type="button" onClick={() => setQuery(b)} className="shrink-0 rounded-full border border-ink-900/10 bg-white px-3 py-2 text-xs font-semibold text-ink-600">
              {b}
            </button>
          ))}
        </div>
      </div>

      {loading && <Spinner label="Carregando inspirações..." />}
      {error && <Alert tone="error" action={<button className="font-semibold underline" onClick={() => reload()}>Tentar novamente</button>}>{error}</Alert>}
      {data && items.length === 0 && (
        <EmptyState icon={<Sparkles className="h-10 w-10" />} title={all.length ? 'Nenhuma foto encontrada' : 'Em breve, novas inspirações'}>
          {all.length ? (onlyFavorites ? 'Você ainda não favoritou nenhuma foto com esse filtro.' : 'Tente outra raça ou limpe a busca.') : 'A Karolla Pet está preparando fotos dos trabalhos. Volte logo!'}
        </EmptyState>
      )}
      {items.length > 0 && <InspirationGrid items={items} onOpen={(i) => setOpen(items[i]!.id)} isFavorite={isFavorite} />}

      <InstagramFeed />

      {openIndex >= 0 && (
        <InspirationViewer
          items={items}
          index={openIndex}
          onIndex={(i) => setOpen(items[i]!.id)}
          onClose={() => setOpen(null)}
          isFavorite={isFavorite}
          onToggleFavorite={toggle}
        />
      )}
    </div>
  );
}
