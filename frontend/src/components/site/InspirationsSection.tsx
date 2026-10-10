import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { publicApi } from '@/services/publicApi';
import { useAsync } from '@/hooks/useAsync';
import { useFavorites } from '@/hooks/useFavorites';
import { ButtonLink } from '@/components/ui/Button';
import { InspirationGrid } from '@/components/inspirations/InspirationGrid';
import { InspirationViewer } from '@/components/inspirations/InspirationViewer';
import { InstagramButton } from '@/components/inspirations/InstagramButton';
import { GallerySection } from './GallerySection';
import { Section } from './Section';

/**
 * Prévia do catálogo de inspirações na home (substitui a galeria quando há fotos cadastradas).
 * Sem fotos ainda, mantém a galeria ilustrada.
 */
export function InspirationsSection() {
  const { data } = useAsync(() => publicApi.inspirations(), []);
  const { isFavorite, toggle } = useFavorites();
  const [open, setOpen] = useState<number | null>(null);
  if (!data) return null;
  if (data.length === 0) return <GallerySection />;
  const items = data.slice(0, 6);
  return (
    <Section id="galeria" eyebrow="Inspirações" title="Escolha o visual do seu pet" intro="Fotos por raça para você mostrar exatamente o que deseja. Toque para ampliar." className="bg-white">
      <InspirationGrid items={items} onOpen={setOpen} isFavorite={isFavorite} />
      <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <ButtonLink to="/inspiracoes" size="lg" icon={<ArrowRight className="h-5 w-5" aria-hidden />}>
          Ver todas as inspirações
        </ButtonLink>
        <InstagramButton className="h-14 px-7" />
      </div>
      {open !== null && <InspirationViewer items={items} index={open} onIndex={setOpen} onClose={() => setOpen(null)} isFavorite={isFavorite} onToggleFavorite={toggle} />}
    </Section>
  );
}
