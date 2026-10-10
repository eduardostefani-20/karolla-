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

    async inspirations(_req: Request, res: Response) {
      res.set('Cache-Control', 'no-store');
      res.json(await c.media.listPublicInspirations());
    },

    async inspiration(req: Request, res: Response) {
      res.json(await c.media.getPublicInspiration(String(req.params.id)));
    },

    /** Somente stories válidos: a expiração usa o expiresAt gravado no banco. */
    async stories(_req: Request, res: Response) {
      res.set('Cache-Control', 'no-store');
      res.json(await c.media.listPublicStories());
    },

    async instagramFeed(_req: Request, res: Response) {
      res.set('Cache-Control', 'public, max-age=600');
      res.json(await c.instagram.getFeed());
    },

    async createAppointment(req: Request, res: Response) {
      const input = parse(bookingRequestSchema, req.body);
      res.status(201).json(await c.booking.createBooking(input));
    },
  };
}
