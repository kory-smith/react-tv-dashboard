/// <reference types="@cloudflare/workers-types" />
import type { Env, SessionData, User } from '../types';
import { Role } from '../types';
import { getUserById } from '../db';
import { hashPassword, verifyPassword } from '../utils/password';
import { nanoid } from 'nanoid';

// Session duration constants (in seconds)
const SESSION_DURATION = 24 * 60 * 60; // 24 hours
const EXTENDED_SESSION_DURATION = 30 * 24 * 60 * 60; // 30 days

/**
 * Hash a password using crypto
 */
export { hashPassword } from '../utils/password';

/**
 * Verify a password against a hash
 */
export { verifyPassword } from '../utils/password';

/**
 * Create a new session for a user
 */
export async function createSession(env: Env, userId: number, extended = false): Promise<string> {
  const sessionId = nanoid(32);
  const expires = Math.floor(Date.now() / 1000) + (extended ? EXTENDED_SESSION_DURATION : SESSION_DURATION);

  const sessionData: SessionData = {
    userId,
    expires
  };

  await env.SESSION_STORE.put(sessionId, JSON.stringify(sessionData));
  return sessionId;
}

/**
 * Get session data from KV store
 */
export async function getSession(env: Env, sessionId: string): Promise<SessionData | null> {
  const sessionJson = await env.SESSION_STORE.get(sessionId);
  if (!sessionJson) return null;

  try {
    const sessionData = JSON.parse(sessionJson) as SessionData;
    
    // Check if the session has expired
    const now = Math.floor(Date.now() / 1000);
    if (sessionData.expires < now) {
      await deleteSession(env, sessionId);
      return null;
    }
    
    return sessionData;
  } catch (e) {
    // Invalid session data format
    await deleteSession(env, sessionId);
    return null;
  }
}

/**
 * Delete a session from KV store
 */
export async function deleteSession(env: Env, sessionId: string): Promise<void> {
  await env.SESSION_STORE.delete(sessionId);
}

/**
 * Parse cookies from cookie header
 */
export function parseCookies(cookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  
  if (!cookieHeader) return cookies;
  
  cookieHeader.split(';').forEach(cookie => {
    const [name, value] = cookie.split('=').map(c => c.trim());
    if (name && value) {
      cookies[name] = value;
    }
  });
  
  return cookies;
}

/**
 * Create a session cookie string
 */
export function createSessionCookie(sessionId: string, maxAge?: number): string {
  let cookie = `__session=${sessionId}; Path=/; HttpOnly; SameSite=Lax`;
  
  if (maxAge) {
    cookie += `; Max-Age=${maxAge}`;
  }
  
  return cookie;
}

/**
 * Get the authenticated user from a request
 * Returns the user or null if no valid session
 */
export async function getAuthenticatedUser(request: Request, env: Env): Promise<User | null> {
  const cookie = request.headers.get('Cookie') || '';
  const cookies = parseCookies(cookie);
  const sessionId = cookies['__session'];
  
  if (!sessionId) return null;
  
  const session = await getSession(env, sessionId);
  if (!session) return null;
  
  return getUserById(env.DB, session.userId);
}

/**
 * Middleware to require authentication
 * Returns the authenticated user or a Response if authentication failed
 */
export async function requireAuth(request: Request, env: Env): Promise<User | Response> {
  const user = await getAuthenticatedUser(request, env);
  
  if (!user) {
    return new Response(JSON.stringify({ error: 'Authentication required' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  return user;
}

/**
 * Middleware to require specific role(s)
 * Returns the authenticated user or a Response if authentication or authorization failed
 */
export async function requireRole(request: Request, env: Env, roles: Role[]): Promise<User | Response> {
  const result = await requireAuth(request, env);
  
  if (result instanceof Response) {
    return result;
  }
  
  const user = result;
  
  if (!roles.includes(user.role)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  return user;
}

// Helper functions to check roles
export function isAdmin(user: { role: Role } | null): boolean {
  return user?.role === Role.ADMIN;
}

export function isManager(user: { role: Role } | null): boolean {
  return user?.role === Role.ADMIN || user?.role === Role.MANAGER;
}

export function isEmployee(user: { role: Role } | null): boolean {
  return !!user?.role;
} 