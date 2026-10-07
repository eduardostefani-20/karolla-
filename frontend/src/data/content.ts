import type { PetIllustrationProps } from '@/components/site/PetIllustration';

export interface GalleryItem {
  caption: string;
  /** Caminho de foto real em /public/images (opcional). Sem foto, usa a ilustração. */
  photo?: string;
  pet: PetIllustrationProps;
}

const gallery: GalleryItem[] = [
  { caption: 'Banho com espuma e muito carinho', pet: { kind: 'dog', fur: '#f0c58f', furDark: '#d39a5c', bubbles: true } },
  { caption: 'Tosa caprichada e lacinho', pet: { kind: 'dog', fur: '#fdfaf6', furDark: '#e6d7c3', accessory: 'bow', accent: '#ff7d57' } },
  { caption: 'Gatinhos também são bem-vindos', pet: { kind: 'cat', fur: '#f2a65a', furDark: '#d9823a' } },
  { caption: 'Pronto para passear!', pet: { kind: 'dog', fur: '#5b4636', furDark: '#3f2f24', muzzle: '#c9a98b', accessory: 'bandana', accent: '#279790' } },
  { caption: 'Escovação para pelos macios', pet: { kind: 'cat', fur: '#3a3f4a', furDark: '#252a33', muzzle: '#f4f6f8', accessory: 'bow', accent: '#ffc533' } },
  { caption: 'Cheirosinho e feliz', pet: { kind: 'dog', fur: '#d9d9d9', furDark: '#9ca3af', accessory: 'bandana', accent: '#ff7d57' } },
];

/**
 * Textos institucionais do site público.
 * Serviços, preços, horários e contatos NÃO ficam aqui — vêm do banco (painel administrativo).
 * Para trocar ilustrações por fotos reais, preencha `photo` (arquivo em /public/images) — veja docs/CONTEUDO.md.
 */

export const siteContent = {
  hero: {
    eyebrow: 'Banho • Tosa • Estética pet',
    title: 'Seu pet cheiroso, feliz e bem cuidado.',
    subtitle:
      'Na Karolla Pet cada banho e cada tosa são feitos com calma, carinho e atenção aos detalhes. Escolha o serviço, veja o valor na hora e agende em poucos minutos.',
  },
  about: {
    title: 'Cuidado de verdade, do jeitinho que seu pet merece',
    paragraphs: [
      'A Karolla Pet nasceu do amor pelos animais e da vontade de oferecer um banho e tosa em que o tutor possa confiar de olhos fechados.',
      'Aqui o atendimento é feito sem pressa: respeitamos o tempo de cada pet, usamos produtos adequados para cada tipo de pelagem e mantemos você informado do início ao fim.',
    ],
    highlights: ['Atendimento individualizado', 'Produtos específicos por pelagem', 'Ambiente limpo e tranquilo'],
  },
  howItWorks: [
    { title: 'Escolha o serviço', text: 'Banho, tosa, combo ou cuidados extras — com o preço calculado na hora.' },
    { title: 'Cadastre seu pet', text: 'Nome, raça e porte. Leva menos de um minuto.' },
    { title: 'Escolha data e horário', text: 'Veja os horários livres de verdade, sem troca de mensagens.' },
    { title: 'Confirme o agendamento', text: 'A Karolla Pet confirma tudo com você pelo WhatsApp.' },
  ],
  differentials: [
    { icon: 'heart', title: 'Carinho em cada etapa', text: 'Manuseio gentil, pausas quando necessário e muito respeito ao bem-estar do pet.' },
    { icon: 'sparkles', title: 'Produtos de qualidade', text: 'Shampoos e finalizadores escolhidos para cada tipo de pele e pelagem.' },
    { icon: 'shield', title: 'Higiene impecável', text: 'Equipamentos e ambiente higienizados entre um atendimento e outro.' },
    { icon: 'clock', title: 'Horário respeitado', text: 'Agenda organizada para seu pet não ficar esperando à toa.' },
    { icon: 'message', title: 'Você sempre informado', text: 'Confirmação e contato direto pelo WhatsApp.' },
    { icon: 'tag', title: 'Preço transparente', text: 'O valor aparece antes de você confirmar. Sem surpresas.' },
  ],
  gallery,
  faq: [
    {
      q: 'Como funciona o agendamento online?',
      a: 'Você escolhe a espécie, informa os dados do pet, escolhe o serviço, os adicionais, a data e o horário. O valor aparece na hora. Depois de confirmar, a Karolla Pet entra em contato pelo WhatsApp para confirmar o atendimento.',
    },
    {
      q: 'Como sei o porte do meu pet?',
      a: 'Use o peso como referência — mostramos a faixa de peso de cada porte no formulário. Se tiver dúvida, escolha o mais próximo: a equipe confere no dia e avisa se houver qualquer diferença.',
    },
    {
      q: 'Minha raça não está na lista. E agora?',
      a: 'Sem problema! Escolha "Outra raça" e digite o nome da raça (ou "sem raça definida").',
    },
    {
      q: 'Posso remarcar ou cancelar?',
      a: 'Pode sim. Fale com a gente pelo WhatsApp com antecedência e ajustamos o melhor horário para você.',
    },
    {
      q: 'Vocês fazem consulta veterinária ou vacinação?',
      a: 'Não. A Karolla Pet é um pet shop focado em banho, tosa e estética animal. Para questões de saúde, procure um médico-veterinário de confiança.',
    },
    {
      q: 'Preciso levar algo no dia?',
      a: 'Apenas o seu pet, com coleira e guia (ou caixa de transporte para gatos). Se ele tiver alguma sensibilidade, conte para a gente nas observações do agendamento.',
    },
  ],
  finalCta: {
    title: 'Agende o cuidado do seu pet.',
    text: 'Leva só alguns minutos e você já sai com o valor e o horário escolhidos.',
  },
};
