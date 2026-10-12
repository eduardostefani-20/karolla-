import type { DatabaseService } from '../repositories/types';
import { AppError } from '../utils/errors';

/**
 * Antes da migração indicada, campos novos não podem ser gravados (o banco não os tem).
 * Em vez de descartar o valor em silêncio, avisa que o recurso ainda está sendo ativado.
 */
export async function assertSchemaFor(db: DatabaseService, level: 9 | 10, used: boolean, what: string): Promise<void> {
  if (used && !(await db.featuresReady(level))) {
    throw new AppError(409, 'SETUP_PENDING', `${what} fica disponível depois da atualização do banco de dados.`);
  }
}
