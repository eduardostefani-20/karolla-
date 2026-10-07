/** Relógio injetável — permite testes determinísticos de regras de data/hora. */
export interface Clock {
  now(): Date;
}
export const systemClock: Clock = { now: () => new Date() };
