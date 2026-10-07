import type { Request, Response } from 'express';
import { bookingRequestSchema } from '@karolla/shared';
import type { Container } from '../container';
import { parse } from '../middleware/validate';
import { availabilityQuerySchema } from '../validators/query';

export function publicController(c: Container) {
  return {
    async catalog(_req: Request, res: Response) {
      res.set('Cache-Control', 'no-store');
      res.json(await c.catalog.getPublicCatalog());
    },

    async availability(req: Request, res: Response) {
      const query = parse(availabilityQuerySchema, req.query);
      res.set('Cache-Control', 'no-store');
      res.json(await c.booking.getAvailability(query));
    },

    async createAppointment(req: Request, res: Response) {
      const input = parse(bookingRequestSchema, req.body);
      res.status(201).json(await c.booking.createBooking(input));
    },
  };
}
