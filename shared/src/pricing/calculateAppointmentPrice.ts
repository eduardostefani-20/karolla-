import type { Addon, PetSize, Service, ServicePrice } from '../types/domain';

/**
 * MOTOR DE PREÇOS — fonte única de cálculo de valores da Karolla Pet.
 *
 *   SERVIÇO(S) (preço por porte) + ADICIONAIS = VALOR FINAL
 *
 * Usado pelo front-end (preço em tempo real) e pelo back-end (valor gravado no banco).
 * O back-end SEMPRE recalcula: o valor enviado pelo navegador nunca é confiável.
 * Nenhum preço deve ser escrito diretamente em componentes ou controllers.
 */

export interface PricingCatalog {
  services: Service[];
  servicePrices: ServicePrice[];
  addons: Addon[];
  sizes: PetSize[];
}

export interface PriceRequest {
  serviceIds: string[];
  sizeId: string;
  addonIds: string[];
  /** Quando informado, valida se o serviço atende a espécie. */
  speciesId?: string;
}

export interface PriceLine {
  kind: 'service' | 'addon';
  refId: string;
  name: string;
  priceCents: number;
  durationMinutes: number;
}

export interface PriceBreakdown {
  lines: PriceLine[];
  servicesCents: number;
  addonsCents: number;
  totalCents: number;
  totalDurationMinutes: number;
}

export type PricingErrorCode =
  | 'NO_SERVICE'
  | 'SERVICE_NOT_FOUND'
  | 'SERVICE_INACTIVE'
  | 'SERVICE_NOT_AVAILABLE_FOR_SPECIES'
  | 'SIZE_NOT_FOUND'
  | 'SIZE_INACTIVE'
  | 'PRICE_NOT_CONFIGURED'
  | 'ADDON_NOT_FOUND'
  | 'ADDON_INACTIVE'
  | 'DUPLICATED_ITEM';

const MESSAGES: Record<PricingErrorCode, string> = {
  NO_SERVICE: 'Escolha pelo menos um serviço.',
  SERVICE_NOT_FOUND: 'O serviço escolhido não existe mais.',
  SERVICE_INACTIVE: 'O serviço escolhido não está disponível no momento.',
  SERVICE_NOT_AVAILABLE_FOR_SPECIES: 'Este serviço não está disponível para a espécie escolhida.',
  SIZE_NOT_FOUND: 'O porte escolhido não existe mais.',
  SIZE_INACTIVE: 'O porte escolhido não está disponível no momento.',
  PRICE_NOT_CONFIGURED: 'Ainda não há preço configurado para este serviço neste porte.',
  ADDON_NOT_FOUND: 'Um dos adicionais escolhidos não existe mais.',
  ADDON_INACTIVE: 'Um dos adicionais escolhidos não está disponível no momento.',
  DUPLICATED_ITEM: 'Há itens repetidos no agendamento.',
};

export class PricingError extends Error {
  constructor(
    public readonly code: PricingErrorCode,
    public readonly refId?: string,
  ) {
    super(MESSAGES[code]);
    this.name = 'PricingError';
  }
}

export interface PricingOptions {
  /**
   * Permite itens inativos (usado pelo painel ao editar agendamentos antigos
   * que referenciam serviços já desativados). O site público nunca usa.
   */
  allowInactive?: boolean;
}

export function findServicePrice(
  catalog: Pick<PricingCatalog, 'servicePrices'>,
  serviceId: string,
  sizeId: string,
): ServicePrice | undefined {
  return catalog.servicePrices.find((p) => p.serviceId === serviceId && p.sizeId === sizeId);
}

export function calculateAppointmentPrice(
  request: PriceRequest,
  catalog: PricingCatalog,
  options: PricingOptions = {},
): PriceBreakdown {
  const { allowInactive = false } = options;

  if (request.serviceIds.length === 0) throw new PricingError('NO_SERVICE');
  if (new Set(request.serviceIds).size !== request.serviceIds.length) throw new PricingError('DUPLICATED_ITEM');
  if (new Set(request.addonIds).size !== request.addonIds.length) throw new PricingError('DUPLICATED_ITEM');

  const size = catalog.sizes.find((s) => s.id === request.sizeId);
  if (!size) throw new PricingError('SIZE_NOT_FOUND', request.sizeId);
  if (!size.active && !allowInactive) throw new PricingError('SIZE_INACTIVE', size.id);

  const lines: PriceLine[] = [];

  for (const serviceId of request.serviceIds) {
    const service = catalog.services.find((s) => s.id === serviceId);
    if (!service) throw new PricingError('SERVICE_NOT_FOUND', serviceId);
    if (!service.active && !allowInactive) throw new PricingError('SERVICE_INACTIVE', serviceId);
    if (
      request.speciesId &&
      service.speciesIds.length > 0 &&
      !service.speciesIds.includes(request.speciesId)
    ) {
      throw new PricingError('SERVICE_NOT_AVAILABLE_FOR_SPECIES', serviceId);
    }
    const price = findServicePrice(catalog, serviceId, size.id);
    if (!price) throw new PricingError('PRICE_NOT_CONFIGURED', serviceId);
    lines.push({
      kind: 'service',
      refId: service.id,
      name: service.name,
      priceCents: price.priceCents,
      durationMinutes: price.durationMinutes ?? service.durationMinutes,
    });
  }

  for (const addonId of request.addonIds) {
    const addon = catalog.addons.find((a) => a.id === addonId);
    if (!addon) throw new PricingError('ADDON_NOT_FOUND', addonId);
    if (!addon.active && !allowInactive) throw new PricingError('ADDON_INACTIVE', addonId);
    lines.push({
      kind: 'addon',
      refId: addon.id,
      name: addon.name,
      priceCents: addon.priceCents,
      durationMinutes: addon.durationMinutes,
    });
  }

  const sum = (kind: PriceLine['kind']) =>
    lines.filter((l) => l.kind === kind).reduce((acc, l) => acc + l.priceCents, 0);
  const servicesCents = sum('service');
  const addonsCents = sum('addon');

  return {
    lines,
    servicesCents,
    addonsCents,
    totalCents: servicesCents + addonsCents,
    totalDurationMinutes: lines.reduce((acc, l) => acc + l.durationMinutes, 0),
  };
}

/** Menor preço de um serviço entre os portes ativos ("a partir de"). `null` se não houver preço. */
export function getStartingPrice(serviceId: string, catalog: Pick<PricingCatalog, 'servicePrices' | 'sizes'>): number | null {
  const activeSizes = new Set(catalog.sizes.filter((s) => s.active).map((s) => s.id));
  const prices = catalog.servicePrices
    .filter((p) => p.serviceId === serviceId && activeSizes.has(p.sizeId))
    .map((p) => p.priceCents);
  return prices.length ? Math.min(...prices) : null;
}
