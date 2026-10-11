import { ButtonLink } from '@/components/ui/Button';
import { FUR, PetIllustration } from '@/components/site/PetIllustration';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';

export default function NotFoundPage() {
  useDocumentMeta({ title: 'Página não encontrada — Karolla Pet', noindex: true });
  return (
    <div className="container-page flex flex-col items-center py-20 text-center">
      <PetIllustration className="w-40" kind="cat" {...FUR.silver} />
      <h1 className="title-display mt-6 text-display-page text-primary">Ops! Essa página fugiu para passear.</h1>
      <p className="mt-2 text-ink-500">O endereço pode ter mudado. Que tal voltar ao início?</p>
      <ButtonLink to="/" className="mt-6">
        Voltar para o início
      </ButtonLink>
    </div>
  );
}
