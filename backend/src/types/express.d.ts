import type { AdminUser, Customer } from '@karolla/shared';
import type { AuthIdentity } from '../integrations/auth/AuthService';

declare global {
  namespace Express {
    interface Request {
      admin?: AdminUser;
      /** Portal do cliente: identidade do login e cadastro vinculado (null = vínculo pendente). */
      identity?: AuthIdentity;
      customer?: Customer | null;
    }
  }
}

export {};
