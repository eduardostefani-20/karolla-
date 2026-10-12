import type { AdminComment, Customer, PublicComment } from '@karolla/shared';
import type { DatabaseService } from '../repositories/types';
import type { Clock } from '../utils/clock';
import { ConflictError, NotFoundError, TooManyRequestsError } from '../utils/errors';

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? '';

/**
 * Comentários nas inspirações: só clientes com conta, ligados à inspiração e com o primeiro nome do autor.
 * Texto simples (o site exibe como texto, nunca como HTML) e sem links; limites contra spam.
 * A equipe pode remover; remover um comentário não apaga o cliente nem outros registros.
 */
export class CommentService {
  constructor(
    private readonly db: DatabaseService,
    private readonly clock: Clock,
  ) {}

  private async activeInspiration(id: string) {
    const inspiration = await this.db.inspirations.findById(id);
    if (!inspiration || !inspiration.active) throw new NotFoundError('Inspiração não encontrada.');
    return inspiration;
  }

  async listPublic(inspirationId: string): Promise<PublicComment[]> {
    await this.activeInspiration(inspirationId);
    return (await this.db.comments.list({ inspirationId }))
      .filter((c) => c.status === 'visible')
      .map(({ id, authorName, body, createdAt }) => ({ id, authorName, body, createdAt }));
  }

  async create(customer: Customer, inspirationId: string, body: string): Promise<PublicComment> {
    await this.activeInspiration(inspirationId);
    const now = this.clock.now().getTime();
    const mine = (await this.db.comments.list({ customerId: customer.id })).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const age = (iso: string) => now - Date.parse(iso);
    if (mine[0] && age(mine[0].createdAt) < 20_000) throw new TooManyRequestsError('Espere alguns segundos antes de comentar de novo.');
    if (mine.filter((c) => age(c.createdAt) < 60 * 60_000).length >= 10) throw new TooManyRequestsError('Você comentou bastante na última hora. Tente mais tarde.');
    const normalized = body.trim().toLowerCase();
    if (mine.some((c) => c.inspirationId === inspirationId && c.body.trim().toLowerCase() === normalized && age(c.createdAt) < 24 * 60 * 60_000)) {
      throw new ConflictError('DUPLICATED', 'Você já enviou este comentário.');
    }
    const comment = await this.db.comments.create({
      inspirationId,
      customerId: customer.id,
      authorName: firstName(customer.name) || 'Cliente',
      body: body.trim(),
      status: 'visible',
    });
    return { id: comment.id, authorName: comment.authorName, body: comment.body, createdAt: comment.createdAt };
  }

  async listAdmin(): Promise<AdminComment[]> {
    const [comments, inspirations, customers] = await Promise.all([this.db.comments.list(), this.db.inspirations.list(), this.db.customers.list()]);
    const titles = new Map(inspirations.map((i) => [i.id, i.title]));
    const names = new Map(customers.map((c) => [c.id, c.name]));
    return comments
      .map((c) => ({ ...c, inspirationTitle: titles.get(c.inspirationId) ?? '', customerName: names.get(c.customerId) ?? '' }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  /** Remove da página (fica guardado como "removido" para histórico). */
  async remove(id: string): Promise<void> {
    const comment = await this.db.comments.findById(id);
    if (!comment) throw new NotFoundError('Comentário não encontrado.');
    await this.db.comments.update(id, { status: 'removed' });
  }
}
