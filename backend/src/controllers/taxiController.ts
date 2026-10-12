import type { Request, Response } from 'express';
import { z } from 'zod';
import { dateSchema, idSchema, settingsSchema, taxiBlockSchema, taxiDriverSchema, taxiRegionSchema, taxiTransportUpdateSchema } from '@karolla/shared';
import type { Container } from '../container';
import { parse } from '../middleware/validate';
import { idParamSchema } from '../validators/query';

const id = (req: Request) => parse(idParamSchema, req.params).id;
const taxiSettingsSchema = settingsSchema.pick({ taxiEnabled: true, taxiWindows: true, taxiPickupLeadMinutes: true, taxiSlotMinutes: true });
const transportsQuery = z.object({ date: dateSchema.optional(), appointmentId: idSchema.optional() });

/** Taxi Dog no painel: configuração e transportes. */
export function taxiController(c: Container) {
  return {
    async overview(_req: Request, res: Response) {
      res.json(await c.taxi.overview());
    },
    async updateSettings(req: Request, res: Response) {
      res.json(await c.taxi.updateSettings(parse(taxiSettingsSchema, req.body)));
    },
    async createRegion(req: Request, res: Response) {
      res.status(201).json(await c.taxi.createRegion(parse(taxiRegionSchema, req.body)));
    },
    async updateRegion(req: Request, res: Response) {
      res.json(await c.taxi.updateRegion(id(req), parse(taxiRegionSchema.partial(), req.body)));
    },
    async createDriver(req: Request, res: Response) {
      res.status(201).json(await c.taxi.createDriver(parse(taxiDriverSchema, req.body)));
    },
    async updateDriver(req: Request, res: Response) {
      res.json(await c.taxi.updateDriver(id(req), parse(taxiDriverSchema.partial(), req.body)));
    },
    async addBlock(req: Request, res: Response) {
      res.status(201).json(await c.taxi.addBlock(parse(taxiBlockSchema, req.body)));
    },
    async removeBlock(req: Request, res: Response) {
      await c.taxi.removeBlock(id(req));
      res.status(204).end();
    },
    async transports(req: Request, res: Response) {
      res.json(await c.taxi.listTransports(parse(transportsQuery, req.query)));
    },
    async updateTransport(req: Request, res: Response) {
      res.json(await c.taxi.updateTransport(id(req), parse(taxiTransportUpdateSchema, req.body), req.admin!));
    },
  };
}
