import { ButtonLink } from '@/components/ui/Button';
import { PetIllustration } from '@/components/site/PetIllustration';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';

export default function NotFoundPage() {
  useDocumentMeta({ title: 'Página não encontrada — Karolla Pet', noindex: true });
  return (
    <div className="container-page flex flex-col items-center py-20 text-center">
      <PetIllustration className="w-40" kind="cat" fur="#9aa5b1" furDark="#6b7684" muzzle="#f4f6f8" />
      <h1 className="mt-6 text-3xl font-semibold">Ops! Essa página fugiu para passear.</h1>
      <p className="mt-2 text-ink-500">O endereço pode ter mudado. Que tal voltar ao início?</p>
      <ButtonLink to="/" className="mt-6">
        Voltar para o início
      </ButtonLink>
    </div>
  );
}
