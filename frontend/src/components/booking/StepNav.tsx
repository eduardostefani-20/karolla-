import { ArrowLeft, ArrowRight } from 'lucide-react';
import { formatCents } from '@karolla/shared';
import { Button } from '@/components/ui/Button';
import { useBookingPrice } from './useBookingPrice';

/**
 * Navegação fixa no rodapé (mobile) / ao final do card (desktop).
 * Sempre oferece "← Voltar" e "Continuar →", com o total visível.
 */
export function StepNav({
  onBack,
  onNext,
  formId,
  nextLabel = 'Continuar',
  nextDisabled,
  loading,
  hideBack,
}: {
  onBack?: () => void;
  onNext?: () => void;
  formId?: string;
  nextLabel?: string;
  nextDisabled?: boolean;
  loading?: boolean;
  hideBack?: boolean;
}) {
  const { price } = useBookingPrice();
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-ink-900/5 bg-white/95 px-4 pb-[max(env(safe-area-inset-bottom),12px)] pt-3 backdrop-blur lg:static lg:mt-8 lg:border-0 lg:bg-transparent lg:p-0">
      {price && (
        <p className="mb-2 flex items-center justify-between text-sm lg:hidden">
          <span className="text-ink-500">Total estimado</span>
          <strong className="font-display text-lg text-brand-700" data-testid="mobile-total">
            {formatCents(price.totalCents)}
          </strong>
        </p>
      )}
      <div className="mx-auto flex max-w-3xl gap-3">
        {!hideBack && (
          <Button variant="outline" size="lg" onClick={onBack} icon={<ArrowLeft className="h-5 w-5" aria-hidden />} className="px-5">
            Voltar
          </Button>
        )}
        <Button
          type={formId ? 'submit' : 'button'}
          form={formId}
          size="lg"
          className="flex-1"
          onClick={formId ? undefined : onNext}
          disabled={nextDisabled}
          loading={loading}
        >
          {nextLabel}
          {!loading && <ArrowRight className="h-5 w-5" aria-hidden />}
        </Button>
      </div>
    </div>
  );
}
