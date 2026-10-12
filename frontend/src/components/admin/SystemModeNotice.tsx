import { FlaskConical } from 'lucide-react';
import { adminApi } from '@/services/adminApi';
import { useAsync } from '@/hooks/useAsync';
import { Alert } from '@/components/ui/Feedback';

/** Aviso honesto quando o painel está em modo DEMO (dados fictícios, integrações não conectadas). */
export function SystemModeNotice() {
  const { data } = useAsync(() => adminApi.systemStatus(), []);
  if (data && data.mode !== 'demo' && data.schema && (!data.schema.portalCrm || !data.schema.agendaPlans)) {
    const pending = [
      !data.schema.portalCrm && 'Minha conta do cliente, fotos dos pets e CRM (migração 0009)',
      !data.schema.agendaPlans && 'novos status, agenda por profissional e planos (migração 0010)',
    ].filter(Boolean);
    return (
      <Alert tone="warning" className="mb-6" title="Atualização do banco pendente">
        Estes recursos ficam “em ativação” até a atualização do banco ser aplicada no Supabase: {pending.join('; ')}. O restante do sistema funciona normalmente.
      </Alert>
    );
  }
  if (!data || data.mode !== 'demo') return null;
  return (
    <Alert tone="warning" className="mb-6" title="Modo demonstração">
      <span className="inline-flex items-center gap-1">
        <FlaskConical className="h-4 w-4" aria-hidden />
        Banco em memória (dados fictícios que somem ao reiniciar). Supabase {data.database.provider === 'supabase' ? 'conectado' : 'não conectado'} •
        Google Sheets {data.googleSheets.configured ? 'configurado' : 'não configurado'} • WhatsApp: {data.whatsapp.provider === 'cloud_api' ? 'Cloud API' : 'link wa.me (sem envio automático)'}.
      </span>
    </Alert>
  );
}
