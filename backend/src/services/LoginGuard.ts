import type { DatabaseService } from '../repositories/types';
import type { Clock } from '../utils/clock';
import { InvalidCredentialsError, TooManyRequestsError } from '../utils/errors';
import { errorMeta, logger } from '../utils/logger';

export const LOGIN_MAX_FAILURES = 5;
export const LOGIN_LOCK_MINUTES = 15;
const ACTION = 'login_failed';

/**
 * Bloqueio de tentativas por E-MAIL, guardado no banco (vale para todas as instâncias do servidor,
 * ao contrário do limite por IP em memória). Depois de 5 senhas erradas em 15 minutos, aquele e-mail
 * fica bloqueado até a janela passar. As tentativas erradas ficam no registro de auditoria.
 */
export class LoginGuard {
  constructor(
    private readonly db: DatabaseService,
    private readonly clock: Clock,
  ) {}

  async attempt<T>(email: string, area: 'painel' | 'conta', login: () => Promise<T>): Promise<T> {
    const actorEmail = email.trim().toLowerCase();
    const since = new Date(this.clock.now().getTime() - LOGIN_LOCK_MINUTES * 60_000).toISOString();
    const failures = await this.db.audit.countSince({ action: ACTION, actorEmail, since }).catch((err) => {
      logger.warn('Falha ao consultar tentativas de login', errorMeta(err));
      return 0;
    });
    if (failures >= LOGIN_MAX_FAILURES) {
      throw new TooManyRequestsError(`Muitas tentativas com senha errada. Aguarde ${LOGIN_LOCK_MINUTES} minutos ou use "Esqueci minha senha".`);
    }
    try {
      return await login();
    } catch (err) {
      if (err instanceof InvalidCredentialsError) {
        await this.db.audit
          .create({ actorId: null, actorEmail, action: ACTION, entity: area === 'painel' ? 'auth' : 'account', entityId: null, status: 401 })
          .catch((e) => logger.warn('Falha ao registrar tentativa de login', errorMeta(e)));
      }
      throw err;
    }
  }
}
