import {
  inspirationSchema,
  storySchema,
  STORY_TTL_HOURS,
  uploadRequestSchema,
  type Inspiration,
  type PublicInspiration,
  type PublicStory,
  type Story,
} from '@karolla/shared';
import type { z } from 'zod';
import type { DatabaseService } from '../repositories/types';
import type { MediaStorage } from '../integrations/storage/MediaStorage';
import { ConflictError, NotFoundError, ValidationError } from '../utils/errors';
import type { Clock } from '../utils/clock';
import { errorMeta, logger } from '../utils/logger';


const toPublicInspiration = ({ storagePath: _s, active: _a, sortOrder: _o, updatedAt: _u, ...rest }: Inspiration): PublicInspiration => rest;
const toPublicStory = ({ storagePath: _s, ...rest }: Story): PublicStory => rest;

/** Uploads, catálogo de inspirações de tosa e Stories de 24h. */
export class MediaService {
  constructor(
    private readonly db: DatabaseService,
    private readonly storage: MediaStorage,
    private readonly clock: Clock,
  ) {}

  createUploadTicket(input: unknown) {
    const req = uploadRequestSchema.parse(input);
    return this.storage.createUploadTicket(req.kind, req.contentType, req.size);
  }

  // ---------------- Inspirações ----------------
  async listPublicInspirations(): Promise<PublicInspiration[]> {
    return (await this.db.inspirations.list({ active: true })).map(toPublicInspiration);
  }

  async getPublicInspiration(id: string): Promise<PublicInspiration> {
    const item = await this.db.inspirations.findById(id);
    if (!item || !item.active) throw new NotFoundError('Inspiração não encontrada.');
    return toPublicInspiration(item);
  }

  listInspirations() {
    return this.db.inspirations.list();
  }

  private async resolveBreed(input: { speciesId?: string; breedId?: string | null; breedName?: string }) {
    if (input.speciesId && !(await this.db.species.findById(input.speciesId))) throw new NotFoundError('Espécie não encontrada.');
    if (input.breedId) {
      const breed = await this.db.breeds.findById(input.breedId);
      if (!breed) throw new NotFoundError('Raça não encontrada.');
      return { breedId: breed.id, breedName: breed.name, speciesId: breed.speciesId };
    }
    return {};
  }

  async createInspiration(input: z.output<typeof inspirationSchema>) {
    const breed = await this.resolveBreed(input);
    if (!input.breedId && !input.breedName) throw new ValidationError('Informe a raça.', { breedName: 'Escolha a raça ou digite o nome.' });
    const all = await this.db.inspirations.list();
    const sortOrder = input.sortOrder || all.reduce((m, i) => Math.max(m, i.sortOrder), 0) + 1;
    return this.db.inspirations.create({ ...input, ...breed, sortOrder });
  }

  async updateInspiration(id: string, input: Partial<z.output<typeof inspirationSchema>>) {
    const current = await this.db.inspirations.findById(id);
    if (!current) throw new NotFoundError('Inspiração não encontrada.');
    const breed = input.breedId !== undefined ? await this.resolveBreed({ speciesId: input.speciesId, breedId: input.breedId }) : {};
    const updated = await this.db.inspirations.update(id, { ...input, ...breed });
    if (input.storagePath !== undefined && current.storagePath && current.storagePath !== input.storagePath) {
      if ((await this.db.appointments.countByInspiration(id)) === 0) await this.storage.remove(current.storagePath);
    }
    return updated;
  }

  /** Inspirações já usadas em agendamentos não são excluídas (a foto continua no histórico): desative. */
  async deleteInspiration(id: string) {
    const item = await this.db.inspirations.findById(id);
    if (!item) throw new NotFoundError('Inspiração não encontrada.');
    if ((await this.db.appointments.countByInspiration(id)) > 0) {
      throw new ConflictError('IN_USE', 'Esta foto já foi escolhida em agendamentos. Desative-a para tirar do site e manter o histórico.');
    }
    await this.db.inspirations.delete(id);
    await this.storage.remove(item.storagePath);
  }

  // ---------------- Stories (24h) ----------------
  private nowIso() {
    return this.clock.now().toISOString();
  }

  async listPublicStories(): Promise<PublicStory[]> {
    return (await this.db.stories.listActive(this.nowIso())).map(toPublicStory);
  }

  listAdminStories() {
    return this.db.stories.listActive(this.nowIso());
  }

  async createStory(input: z.output<typeof storySchema>) {
    const now = this.clock.now(); // validade calculada no servidor e gravada no banco
    const expiresAt = new Date(now.getTime() + STORY_TTL_HOURS * 3_600_000).toISOString();
    return this.db.stories.create({ ...input, expiresAt });
  }

  async deleteStory(id: string) {
    const story = await this.db.stories.findById(id);
    if (!story) throw new NotFoundError('Story não encontrado.');
    await this.db.stories.delete(id);
    await this.storage.remove(story.storagePath);
  }

  /** Remove registros e arquivos de stories vencidos (rodado de hora em hora pela função agendada). */
  async purgeExpiredStories(): Promise<number> {
    const expired = await this.db.stories.listExpired(this.nowIso());
    for (const story of expired) {
      try {
        await this.db.stories.delete(story.id);
        await this.storage.remove(story.storagePath);
      } catch (err) {
        logger.error('Falha ao remover story vencido', { id: story.id, ...errorMeta(err) });
      }
    }
    return expired.length;
  }
}
