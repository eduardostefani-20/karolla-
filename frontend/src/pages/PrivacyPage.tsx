import type { ReactNode } from 'react';
import { buildWhatsAppLink, formatPhone } from '@karolla/shared';
import { useCatalog } from '@/context/CatalogContext';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { openConsentPreferences } from '@/services/consent';
import { configuredPlatforms, joinPlatforms } from '@/services/tracking';

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-xl font-semibold text-ink-900">{title}</h2>
      <div className="space-y-2 text-ink-600">{children}</div>
    </section>
  );
}

/**
 * Política de privacidade (LGPD). Descreve só o que o sistema realmente faz.
 * Revise com quem cuida da parte jurídica da Karolla Pet antes de divulgar.
 */
export default function PrivacyPage() {
  useDocumentMeta({
    title: 'Política de privacidade — Karolla Pet',
    description: 'Como a Karolla Pet usa os dados informados no agendamento online e os cookies do site.',
  });
  const { catalog } = useCatalog();
  const s = catalog?.settings;
  const name = s?.businessName || 'Karolla Pet';
  const platforms = configuredPlatforms(s);
  const phone = s?.whatsappNumber ? formatPhone(s.whatsappNumber.replace(/^55/, '')) : '';

  return (
    <div className="container-page max-w-3xl py-12 sm:py-16">
      <span className="eyebrow">LGPD</span>
      <h1 className="mt-4 text-3xl font-semibold sm:text-4xl">Política de privacidade</h1>
      <p className="mt-3 text-ink-500">
        Esta página explica quais dados a {name} recebe pelo site, para que usa e como você pode pedir acesso, correção ou exclusão.
      </p>

      <div className="mt-10 space-y-8 leading-relaxed">
        <Block title="Quais dados coletamos">
          <p>Quando você agenda pelo site, recebemos apenas o que você preenche no formulário:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>Seus dados:</strong> nome, WhatsApp e, quando pedidos, e-mail e endereço.
            </li>
            <li>
              <strong>Dados do pet:</strong> nome, espécie, raça, porte e, quando pedidos, peso, idade e observações.
            </li>
            <li>
              <strong>Do agendamento:</strong> serviço, adicionais, data, horário, valor e a foto de inspiração escolhida (se houver).
            </li>
            <li>
              <strong>Origem da visita:</strong> se você chegou por um link de anúncio ou de outro site (ex.: Instagram, Google), guardamos essa
              informação junto com o agendamento para saber quais divulgações funcionam.
            </li>
          </ul>
        </Block>

        <Block title="Para que usamos">
          <p>
            Para agendar e realizar o atendimento do seu pet, confirmar o horário e falar com você pelo WhatsApp, e manter o histórico de atendimentos.
            Não vendemos seus dados.
          </p>
        </Block>

        <Block title="Onde os dados ficam">
          <p>
            Os dados ficam no sistema de agendamento da {name}, hospedado em provedores de nuvem (banco de dados Supabase e site na Netlify),
            com acesso restrito à equipe por login e senha. As mensagens de confirmação usam o WhatsApp.
          </p>
        </Block>

        <Block title="Cookies e anúncios">
          {platforms.length ? (
            <>
              <p>
                Usamos cookies de anúncios de {joinPlatforms(platforms)} <strong>somente se você tocar em “Aceitar”</strong> no aviso de cookies.
                Eles ajudam a medir quantas pessoas agendam depois de ver um anúncio e a mostrar a divulgação para quem tem interesse.
                Essas empresas tratam os dados de acordo com as próprias políticas de privacidade.
              </p>
              <p>Se você recusar, o site e o agendamento funcionam normalmente, sem esses cookies.</p>
              <button type="button" onClick={openConsentPreferences} className="font-semibold text-brand-700 underline">
                Mudar minha escolha de cookies
              </button>
            </>
          ) : (
            <p>No momento o site não usa cookies de anúncios. Usamos apenas o armazenamento do seu navegador para lembrar favoritos, o andamento do agendamento e a origem da visita.</p>
          )}
        </Block>

        <Block title="Seus direitos">
          <p>
            Pela Lei Geral de Proteção de Dados (Lei 13.709/2018), você pode pedir a qualquer momento: confirmação e acesso aos seus dados,
            correção, exclusão, informações sobre compartilhamento e revogação do consentimento.
          </p>
        </Block>

        <Block title="Contato">
          <p>Para qualquer pedido sobre seus dados, fale com a {name}:</p>
          <ul className="list-disc space-y-1 pl-5">
            {s?.whatsappNumber && (
              <li>
                WhatsApp:{' '}
                <a className="font-semibold text-brand-700 underline" href={buildWhatsAppLink(s.whatsappNumber)} target="_blank" rel="noopener noreferrer">
                  {phone}
                </a>
              </li>
            )}
            {s?.contactEmail && (
              <li>
                E-mail:{' '}
                <a className="font-semibold text-brand-700 underline" href={`mailto:${s.contactEmail}`}>
                  {s.contactEmail}
                </a>
              </li>
            )}
          </ul>
        </Block>

        <p className="text-sm text-ink-400">Última atualização: outubro de 2026.</p>
      </div>
    </div>
  );
}
