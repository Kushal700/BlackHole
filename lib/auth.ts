import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "blackhole_session";

function secret() {
  return process.env.AUTH_SECRET || process.env.APP_PASSWORD || "local-development-only-secret-change-me";
}

function signature(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

export function createSessionToken() {
  const payload = `owner:${Date.now() + 1000 * 60 * 60 * 24 * 14}`;
  return `${payload}.${signature(payload)}`;
}

export function verifySessionToken(token?: string) {
  if (!token) return false;
  const separator = token.lastIndexOf(".");
  if (separator < 0) return false;
  const payload = token.slice(0, separator);
  const supplied = token.slice(separator + 1);
  const expected = signature(payload);
  if (supplied.length !== expected.length) return false;
  if (!timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) return false;
  const expires = Number(payload.split(":")[1]);
  return Number.isFinite(expires) && expires > Date.now();
}

export async function isAuthenticated() {
  if (!process.env.APP_PASSWORD) return true;
  const cookieStore = await cookies();
  return verifySessionToken(cookieStore.get(COOKIE_NAME)?.value);
}

export function passwordMatches(value: string) {
  const expected = process.env.APP_PASSWORD;
  if (!expected || value.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(value), Buffer.from(expected));
}

export const authCookie = { name: COOKIE_NAME, secure: process.env.NODE_ENV === "production" };
