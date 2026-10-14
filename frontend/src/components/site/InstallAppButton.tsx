import { useEffect, useState } from 'react';
import { Download, Share, SquarePlus } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { canPromptInstall, isIos, isStandalone, onInstallChange, promptInstall } from '@/services/pwa';
import { cn } from '@/utils/cn';

/** "Instalar o app": usa o convite do navegador quando existe; no iPhone, mostra o passo a passo. */
export function InstallAppButton({ className }: { className?: string }) {
  const [, force] = useState(0);
  const [help, setHelp] = useState(false);
  useEffect(() => onInstallChange(() => force((n) => n + 1)), []);
  if (isStandalone()) return null;

  const install = async () => {
    if (canPromptInstall()) await promptInstall();
    else setHelp(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={install}
        className={cn('inline-flex items-center gap-2 rounded-pill bg-white/10 px-4 py-2 text-sm font-bold text-white hover:bg-white/20', className)}
      >
        <Download className="h-4 w-4" aria-hidden /> Instalar o app
      </button>
      <Modal open={help} onClose={() => setHelp(false)} title="Instalar o app Karolla Pet" footer={<Button onClick={() => setHelp(false)}>Entendi</Button>}>
        {isIos() ? (
          <ol className="list-decimal space-y-3 pl-5 text-ink-700">
            <li>Abra este site no <strong>Safari</strong>.</li>
            <li>
              Toque em <strong>Compartilhar</strong> <Share className="inline h-4 w-4 align-text-bottom" aria-label="ícone de compartilhar" /> na barra de baixo.
            </li>
            <li>
              Escolha <strong>Adicionar à Tela de Início</strong> <SquarePlus className="inline h-4 w-4 align-text-bottom" aria-hidden /> e toque em <strong>Adicionar</strong>.
            </li>
          </ol>
        ) : (
          <ol className="list-decimal space-y-3 pl-5 text-ink-700">
            <li>Abra este site no <strong>Chrome</strong>.</li>
            <li>Toque no menu <strong>⋮</strong> (canto de cima).</li>
            <li>
              Escolha <strong>Instalar app</strong> ou <strong>Adicionar à tela inicial</strong>.
            </li>
          </ol>
        )}
        <p className="mt-4 text-sm text-ink-500">O ícone da Karolla Pet aparece no seu celular e abre direto, sem a barra do navegador. Não ocupa espaço como um app de loja.</p>
      </Modal>
    </>
  );
}
