import { describe, expect, it } from 'vitest';
import { attributionChannel, sanitizeAttribution } from '../src';

describe('attributionChannel', () => {
  it('identifica anúncios pelos identificadores de clique', () => {
    expect(attributionChannel({ gclid: 'x' })).toMatchObject({ key: 'google_ads', paid: true });
    expect(attributionChannel({ ttclid: 'x' })).toMatchObject({ key: 'tiktok_ads', paid: true });
  });

  it('usa UTM: meio pago vira anúncio; sem meio pago é orgânico', () => {
    expect(attributionChannel({ utmSource: 'instagram', utmMedium: 'paid' })).toMatchObject({ key: 'meta_ads', paid: true });
    expect(attributionChannel({ utmSource: 'facebook', utmMedium: 'cpc' })).toMatchObject({ key: 'meta_ads' });
    expect(attributionChannel({ utmSource: 'tiktok', utmMedium: 'paid_social' })).toMatchObject({ key: 'tiktok_ads' });
    expect(attributionChannel({ utmSource: 'google', utmMedium: 'cpc' })).toMatchObject({ key: 'google_ads' });
    expect(attributionChannel({ utmSource: 'instagram', utmMedium: 'bio' })).toMatchObject({ key: 'meta', paid: false });
    expect(attributionChannel({ utmSource: 'panfleto' })).toMatchObject({ key: 'src_panfleto', label: 'Panfleto', paid: false });
    expect(attributionChannel({ utmSource: 'kwai', utmMedium: 'cpc' })).toMatchObject({ label: 'Anúncio (Kwai)', paid: true });
    // parâmetro dinâmico da Meta {{site_source_name}}: ig, fb, msg, an
    expect(attributionChannel({ utmSource: 'ig', utmMedium: 'paid' })).toMatchObject({ key: 'meta_ads' });
    expect(attributionChannel({ utmSource: 'fb', utmMedium: 'paid' })).toMatchObject({ key: 'meta_ads' });
    // códigos curtos não pegam nomes parecidos
    expect(attributionChannel({ utmSource: 'android' })).toMatchObject({ key: 'src_android' });
    expect(attributionChannel({ utmSource: 'waze' })).toMatchObject({ key: 'src_waze' });
  });

  it('fbclid sozinho é Instagram/Facebook (pode ser orgânico); referrer e direto', () => {
    expect(attributionChannel({ fbclid: 'x' })).toMatchObject({ key: 'meta', paid: false });
    expect(attributionChannel({ referrer: 'www.google.com.br' })).toMatchObject({ key: 'google', paid: false });
    expect(attributionChannel({ referrer: 'l.instagram.com' })).toMatchObject({ key: 'meta' });
    expect(attributionChannel({ landingPage: '/' })).toMatchObject({ key: 'direct' });
    expect(attributionChannel(null)).toMatchObject({ key: 'unknown' });
  });
});

describe('sanitizeAttribution', () => {
  it('mantém só campos conhecidos, reduz referrer ao domínio e tira parâmetros da página', () => {
    expect(
      sanitizeAttribution({ utmSource: ' instagram ', referrer: 'https://www.google.com/search?q=pet', landingPage: '/agendar?x=1#y', evil: 1, gclid: 5 }),
    ).toEqual({ utmSource: 'instagram', referrer: 'www.google.com', landingPage: '/agendar' });
  });
  it('dados inválidos viram null', () => {
    expect(sanitizeAttribution('x')).toBeNull();
    expect(sanitizeAttribution([])).toBeNull();
    expect(sanitizeAttribution({ capturedAt: 'ontem' })).toBeNull();
    expect(sanitizeAttribution({ utmSource: '<script>' })).toEqual({ utmSource: 'script' });
  });
});
