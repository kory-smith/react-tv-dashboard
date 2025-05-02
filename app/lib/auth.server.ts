import { createCookieSessionStorage, redirect } from "@remix-run/node";
import { db } from "./db";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

// Ensure SESSION_SECRET is set in your environment variables
if (!process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET must be set");
}

// Session Storage Configuration
const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: "__session",
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secrets: [process.env.SESSION_SECRET],
    secure: process.env.NODE_ENV === "production", // Send cookie only over HTTPS in production
    maxAge: 60 * 60 * 24 * 30, // 30 days
  },
});

const USER_SESSION_KEY = "userId";

// --- Session Management ---

export async function getSession(request: Request) {
  const cookie = request.headers.get("Cookie");
  return sessionStorage.getSession(cookie);
}

export async function getUserId(request: Request): Promise<number | undefined> {
  const session = await getSession(request);
  const userId = session.get(USER_SESSION_KEY);
  return userId ? Number(userId) : undefined;
}

export async function getUser(request: Request) {
  const userId = await getUserId(request);
  if (userId === undefined) return null;

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) throw await logout(request); // If user doesn't exist, logout

  return user;
}

export async function createUserSession({
  request,
  userId,
  remember,
  redirectTo,
}: {
  request: Request;
  userId: number;
  remember: boolean;
  redirectTo: string;
}) {
  const session = await getSession(request);
  session.set(USER_SESSION_KEY, userId);
  return redirect(redirectTo, {
    headers: {
      "Set-Cookie": await sessionStorage.commitSession(session, {
        maxAge: remember
          ? 60 * 60 * 24 * 7 // 7 days
          : undefined,
      }),
    },
  });
}

export async function logout(request: Request) {
  const session = await getSession(request);
  return redirect("/", { // Redirect to home page after logout
    headers: {
      "Set-Cookie": await sessionStorage.destroySession(session),
    },
  });
}

// --- Authentication Helpers ---

export async function requireUserId(
  request: Request,
  redirectTo: string = new URL(request.url).pathname
): Promise<number> {
  const userId = await getUserId(request);
  if (!userId) {
    const searchParams = new URLSearchParams([["redirectTo", redirectTo]]);
    throw redirect(`/login?${searchParams}`);
  }
  return userId;
}

export async function requireUser(request: Request) {
  const userId = await requireUserId(request);

  const user = await db.user.findUnique({ where: { id: userId } });
  if (user) return user;

  throw await logout(request); // If user not found in DB, force logout
}

// --- Password Hashing ---

export async function hashPassword(password: string): Promise<string> {
    const salt = randomBytes(16).toString('hex');
    const derivedKey = scryptSync(password, salt, 64).toString('hex');
    return `${salt}:${derivedKey}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
    const [salt, hash] = storedHash.split(':');
    const derivedKey = scryptSync(password, salt, 64).toString('hex');
    return hash === derivedKey;
}

// --- User Creation (Admin Only) ---
// We'll add the actual creation logic later, protected by role checks

// --- Role Checking Helpers ---
export function isAdmin(user: { role: string } | null): boolean {
    return user?.role === "ADMIN";
}

export function isManager(user: { role: string } | null): boolean {
    return user?.role === "ADMIN" || user?.role === "MANAGER";
}

export function isEmployee(user: { role: string } | null): boolean {
    // In this system, all roles are technically employees in some capacity
    return user?.role === "ADMIN" || user?.role === "MANAGER" || user?.role === "EMPLOYEE";
} 