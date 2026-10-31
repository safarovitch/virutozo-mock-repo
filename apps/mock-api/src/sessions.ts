// Cookie sessions (ADR-0005): `nimbus_session` is HttpOnly, Secure, SameSite=Strict, Path=/api.
import { randomBytes } from 'node:crypto';
import type { Role } from '@nimbus/api-client/model';
import { USERS, type DemoUser } from './db';

export const COOKIE = 'nimbus_session';

export interface Session {
  token: string;
  user: DemoUser;
  expiresAt: number;
}

export class Sessions {
  private readonly byToken = new Map<string, Session>();

  constructor(private readonly ttlS: number) {}

  create(role: Role): Session {
    const token = `demo.${role}.${randomBytes(12).toString('hex')}`;
    const session = { token, user: USERS[role], expiresAt: Date.now() + this.ttlS * 1000 };
    this.byToken.set(token, session);
    return session;
  }

  /** The valid session for a token, or undefined (expired sessions are removed). */
  get(token: string | undefined): Session | undefined {
    if (!token) return undefined;
    const session = this.byToken.get(token);
    if (!session) return undefined;
    if (session.expiresAt <= Date.now()) {
      this.byToken.delete(token);
      return undefined;
    }
    return session;
  }

  remove(token: string): void {
    this.byToken.delete(token);
  }

  /** /api/__test/expire-session { all: true } */
  all(): Session[] {
    return [...this.byToken.values()];
  }

  setCookie(session: Session): string {
    return `${COOKIE}=${session.token}; HttpOnly; Secure; SameSite=Strict; Path=/api; Max-Age=${this.ttlS}`;
  }

  clearCookie(): string {
    return `${COOKIE}=; HttpOnly; Secure; SameSite=Strict; Path=/api; Max-Age=0`;
  }
}

export function tokenFromCookie(header: string | undefined): string | undefined {
  for (const part of (header ?? '').split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === COOKIE) return decodeURIComponent(rest.join('='));
  }
  return undefined;
}
