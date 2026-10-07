import type { AdminUser } from '@karolla/shared';

declare global {
  namespace Express {
    interface Request {
      admin?: AdminUser;
    }
  }
}

export {};
