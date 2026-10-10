import { Instagram } from 'lucide-react';
import { instagramProfileUrl } from '@karolla/shared';
import { useCatalog } from '@/context/CatalogContext';
import { ExternalButton } from '@/components/ui/Button';

/** "Ver Instagram": usa o perfil oficial configurado no painel. Sem configuração, não aparece. */
export function InstagramButton({ variant = 'outline', className }: { variant?: 'outline' | 'primary' | 'secondary'; className?: string }) {
  const { catalog } = useCatalog();
  const url = instagramProfileUrl(catalog?.settings.instagram);
  if (!url) return null;
  return (
    <ExternalButton href={url} variant={variant} className={className} icon={<Instagram className="h-5 w-5" aria-hidden />}>
      Ver Instagram
    </ExternalButton>
  );
}
