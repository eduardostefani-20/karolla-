import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Cookie } from 'lucide-react';
import { useCatalog } from '@/context/CatalogContext';
import { Button } from '@/components/ui/Button';
import { CONSENT_CHANGED, CONSENT_OPEN, readConsent, saveConsent, type ConsentChoice } from '@/services/consent';
import { configuredPlatforms, joinPlatforms, loadTrackers, trackEvent, trackPageView, type TrackingConfig } from '@/services/tracking';

/**
 * Liga os pixels de anúncio no site público:
 *  - só se houver algum ID configurado no painel;
 *  - só depois de o visitante aceitar (aviso de cookies — LGPD);
 *  - nunca nas páginas do painel administrativo.
 */
export function TrackingManager() {
  const { catalog } = useCatalog();
  const { pathname } = useLocation();
  const [consent, setConsent] = useState<ConsentChoice | null>(() => readConsent());
  const [bannerOpen, setBannerOpen] = useState(false);
  const loadedRef = useRef(false);
  const lastPath = useRef<string | null>(null);

  const s = catalog?.settings;
  const config: TrackingConfig | null = s
    ? { metaPixelId: s.metaPixelId, googleAdsId: s.googleAdsId, googleAdsBookingLabel: s.googleAdsBookingLabel, googleAdsWhatsappLabel: s.googleAdsWhatsappLabel, tiktokPixelId: s.tiktokPixelId }
    : null;
  const platforms = configuredPlatforms(config);
  const isAdmin = pathname.startsWith('/admin');
  const enabled = platforms.length > 0 && !isAdmin;

  useEffect(() => {
    const onChange = (e: Event) => setConsent((e as CustomEvent<ConsentChoice>).detail);
    const onOpen = () => setBannerOpen(true);
    window.addEventListener(CONSENT_CHANGED, onChange);
    window.addEventListener(CONSENT_OPEN, onOpen);
    return () => {
      window.removeEventListener(CONSENT_CHANGED, onChange);
      window.removeEventListener(CONSENT_OPEN, onOpen);
    };
  }, []);

  // Carrega os pixels após o consentimento; nas próximas páginas, registra a visualização.
  useEffect(() => {
    if (!enabled || consent !== 'granted' || !config) return;
    if (!loadedRef.current) {
      loadTrackers(config);
      loadedRef.current = true;
      lastPath.current = pathname;
      return;
    }
    if (lastPath.current !== pathname) {
      lastPath.current = pathname;
      trackPageView();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, consent, pathname]);

  // Toque em qualquer link do WhatsApp conta como "Contato".
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const link = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (link && /^https?:\/\/(wa\.me|api\.whatsapp\.com)\//.test(link.href)) trackEvent('Contact');
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  if (!enabled || (consent && !bannerOpen)) return null;

  const choose = (choice: ConsentChoice) => {
    const revoking = consent === 'granted' && choice === 'denied' && loadedRef.current;
    saveConsent(choice);
    setBannerOpen(false);
    // Pixels já carregados não podem ser "descarregados": recarrega a página sem eles.
    if (revoking) window.location.reload();
  };

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="cookies-titulo"
      data-testid="consent-banner"
      className="fixed inset-x-0 bottom-0 z-[60] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4"
    >
      <div className="mx-auto max-w-3xl rounded-3xl border border-ink-900/10 bg-white p-4 shadow-soft sm:flex sm:items-center sm:gap-5 sm:p-5">
        <div className="flex gap-3 sm:flex-1">
          <Cookie className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" aria-hidden />
          <div className="text-sm text-ink-600">
            <p id="cookies-titulo" className="font-semibold text-ink-900">
              Cookies de anúncios
            </p>
            <p className="mt-1">
              Com a sua permissão, usamos cookies de {joinPlatforms(platforms)} para medir e melhorar nossos anúncios.
              O site e o agendamento funcionam do mesmo jeito se você recusar.{' '}
              <Link to="/privacidade" className="font-semibold text-brand-700 underline">
                Política de privacidade
              </Link>
            </p>
          </div>
        </div>
        <div className="mt-3 flex gap-2 sm:mt-0 sm:shrink-0">
          <Button variant="outline" size="sm" className="flex-1 sm:flex-none" onClick={() => choose('denied')}>
            Recusar
          </Button>
          <Button size="sm" className="flex-1 sm:flex-none" onClick={() => choose('granted')}>
            Aceitar
          </Button>
        </div>
      </div>
    </div>
  );
}
