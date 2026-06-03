import { CONFIG } from './config';

export class AuthManager {
  private static activeTokens: Set<string> = new Set();

  public static verifyPassword(password: string): boolean {
    return password === CONFIG.DASHBOARD_PASSWORD;
  }

  public static createSession(): string {
    const token = 'ngx_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    this.activeTokens.add(token);
    return token;
  }

  public static validateToken(token: string | undefined): boolean {
    if (!token) return false;
    return this.activeTokens.has(token);
  }

  public static destorySession(token: string): void {
    this.activeTokens.delete(token);
  }
}

// Global ES imports compatibility wrappers
export function checkPassword(password: string): boolean {
  return AuthManager.verifyPassword(password);
}

export function createSession(): string {
  return AuthManager.createSession();
}

export function validateSession(token: string | undefined): boolean {
  return AuthManager.validateToken(token);
}

export function revokeSession(token: string): void {
  AuthManager.destorySession(token);
}
