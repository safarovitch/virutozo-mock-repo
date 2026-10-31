// WebSocket event hub (specs/shared/realtime.md): scoping (RT-12), close codes (WS-5), heartbeat every 15 s,
// at most 5 sockets per session.
import type { ServerEvent } from '@nimbus/api-client/model';
import type { Db } from './db';
import { inScope } from './rbac';
import type { Session, Sessions } from './sessions';

export const CLOSE = { sessionEnded: 4401, originRejected: 4403, tooManyConnections: 4429, goingAway: 1001 } as const;
export const MAX_SOCKETS_PER_SESSION = 5;

export interface Socket {
  send(data: string): void;
  close(code?: number, reason?: string): void;
  on(event: 'close', listener: () => void): unknown;
}

interface Connection {
  socket: Socket;
  session: Session;
}

export class Hub {
  private readonly connections = new Set<Connection>();
  private readonly timer: ReturnType<typeof setInterval>;

  constructor(
    private readonly db: () => Db,
    private readonly sessions: Sessions,
    heartbeatMs: number,
  ) {
    this.timer = setInterval(() => this.heartbeat(), heartbeatMs);
    this.timer.unref?.();
  }

  /** Registers a socket; returns false (and closes it with 4429) when the session already has 5. */
  add(socket: Socket, session: Session): boolean {
    const open = [...this.connections].filter((c) => c.session.token === session.token).length;
    if (open >= MAX_SOCKETS_PER_SESSION) {
      socket.close(CLOSE.tooManyConnections, 'too many connections');
      return false;
    }
    const connection = { socket, session };
    this.connections.add(connection);
    socket.on('close', () => this.connections.delete(connection));
    return true;
  }

  /**
   * Sends an event to every socket allowed to see it (RT-12): providers all tenants, resellers their tenants,
   * tenant roles their own tenant (including tenant.updated / quota.updated without tenant:read).
   * `tenantId: null` means "everyone" (heartbeats).
   */
  publish(event: ServerEvent, tenantId: string | null): void {
    const payload = JSON.stringify(event);
    const tenant = tenantId ? this.db().tenants.get(tenantId) : undefined;
    for (const c of this.connections) {
      if (tenantId === null || inScope(c.session.user, tenant)) c.socket.send(payload);
    }
  }

  /** Closes every socket of one session (logout, expiry) or of all sessions. */
  closeSessions(predicate: (session: Session) => boolean, code: number, reason: string): void {
    for (const c of [...this.connections]) {
      if (predicate(c.session)) {
        this.connections.delete(c);
        c.socket.close(code, reason);
      }
    }
  }

  socketCount(): number {
    return this.connections.size;
  }

  /** Checks the session on every tick (WS-5): expired or signed-out sessions are closed with 4401. */
  heartbeat(): void {
    for (const c of [...this.connections]) {
      if (!this.sessions.get(c.session.token)) {
        this.connections.delete(c);
        c.socket.close(CLOSE.sessionEnded, 'session expired');
      } else {
        c.socket.send(JSON.stringify({ type: 'heartbeat', ts: new Date().toISOString() }));
      }
    }
  }

  stop(): void {
    clearInterval(this.timer);
    for (const c of this.connections) c.socket.close(CLOSE.goingAway, 'server stopping');
    this.connections.clear();
  }
}
