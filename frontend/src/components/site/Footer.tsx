import { Link } from 'react-router-dom';
import { Instagram, Mail, MapPin, MessageCircle } from 'lucide-react';
import { buildWhatsAppLink, formatPhone, instagramProfileUrl, WEEKDAY_SHORT } from '@karolla/shared';
import { useCatalog } from '@/context/CatalogContext';
import { Logo } from './Logo';
import { WaveDivider } from '@/components/brand/BrandShapes';
import { openConsentPreferences } from '@/services/consent';
import { configuredPlatforms } from '@/services/tracking';

export function Footer() {
  const { catalog } = useCatalog();
  const s = catalog?.settings;
  const hours = catalog?.businessHours ?? [];
  const localNumber = s?.whatsappNumber ? s.whatsappNumber.replace(/^55/, '') : '';
  return (
    <footer className="bg-primary-dark text-brand-50">
      <WaveDivider fill="fill-bg-soft" flip className="-mt-px" />
      <div className="container-page grid gap-10 py-14 md:grid-cols-3">
        <div className="space-y-4">
          <Logo size="lg" />
          <p className="max-w-xs text-sm text-brand-200">Banho, tosa e estética animal com carinho, higiene e agendamento online.</p>
        </div>
        <div>
          <h2 className="mb-3 font-heading text-lg font-extrabold text-white">Contato</h2>
          <ul className="space-y-2.5 text-sm">
            {s?.whatsappNumber && (
              <li>
                <a className="inline-flex items-center gap-2 hover:text-white hover:underline underline-offset-2" href={buildWhatsAppLink(s.whatsappNumber)} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="h-4 w-4" aria-hidden /> {formatPhone(localNumber)}
                </a>
              </li>
            )}
            {s?.contactEmail && (
              <li>
                <a className="inline-flex items-center gap-2 hover:text-white hover:underline underline-offset-2" href={`mailto:${s.contactEmail}`}>
                  <Mail className="h-4 w-4" aria-hidden /> {s.contactEmail}
                </a>
              </li>
            )}
            {instagramProfileUrl(s?.instagram) && (
              <li>
                <a className="inline-flex items-center gap-2 hover:text-white hover:underline underline-offset-2" href={instagramProfileUrl(s?.instagram)!} target="_blank" rel="noopener noreferrer">
                  <Instagram className="h-4 w-4" aria-hidden /> Ver Instagram
                </a>
              </li>
            )}
            {(s?.addressLine || s?.city) && (
              <li className="inline-flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {[s.addressLine, s.city].filter(Boolean).join(' — ')}
              </li>
            )}
          </ul>
        </div>
        <div>
          <h2 className="mb-3 font-heading text-lg font-extrabold text-white">Horário de atendimento</h2>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            {[1, 2, 3, 4, 5, 6, 0].map((wd) => {
              const h = hours.find((x) => x.weekday === wd);
              return (
                <li key={wd} className="flex justify-between gap-2">
                  <span className="text-brand-200">{WEEKDAY_SHORT[wd]}</span>
                  <span>{h?.isOpen ? `${h.openTime}–${h.closeTime}` : 'Fechado'}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="container-page flex flex-col items-center justify-between gap-2 py-5 text-xs text-brand-200 sm:flex-row">
          <p>© {new Date().getFullYear()} Karolla Pet. Todos os direitos reservados.</p>
          <nav aria-label="Links legais" className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
            <Link to="/privacidade" className="hover:text-white hover:underline underline-offset-2">
              Política de privacidade
            </Link>
            {configuredPlatforms(s).length > 0 && (
              <button type="button" onClick={openConsentPreferences} className="hover:text-white hover:underline underline-offset-2">
                Preferências de cookies
              </button>
            )}
            <Link to="/admin" className="hover:text-white hover:underline underline-offset-2">
              Área administrativa
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
