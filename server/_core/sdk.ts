import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { ForbiddenError } from "@shared/_core/errors";
import { parse as parseCookieHeader } from "cookie";
import type { Request } from "express";
import { SignJWT, jwtVerify } from "jose";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { ENV } from "./env";

export type SessionPayload = {
  openId: string;
  appId: "supabase-email";
  name: string;
};

class SDKServer {
  private parseCookies(cookieHeader: string | undefined) {
    return new Map(Object.entries(cookieHeader ? parseCookieHeader(cookieHeader) : {}));
  }

  private getSessionSecret() {
    return new TextEncoder().encode(ENV.cookieSecret);
  }

  async createEmailSessionToken(openId: string, name: string): Promise<string> {
    const issuedAt = Date.now();
    const expirationSeconds = Math.floor((issuedAt + ONE_YEAR_MS) / 1000);
    return new SignJWT({ openId, appId: "supabase-email", name })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setExpirationTime(expirationSeconds)
      .sign(this.getSessionSecret());
  }

  async verifySession(cookieValue: string | undefined | null): Promise<SessionPayload | null> {
    if (!cookieValue) return null;
    try {
      const { payload } = await jwtVerify(cookieValue, this.getSessionSecret(), { algorithms: ["HS256"] });
      const openId = payload.openId;
      const appId = payload.appId;
      const name = payload.name;
      if (typeof openId !== "string" || typeof name !== "string" || appId !== "supabase-email") return null;
      return { openId, appId, name };
    } catch {
      return null;
    }
  }

  async authenticateRequest(req: Request): Promise<User> {
    const sessionToken = this.parseCookies(req.headers.cookie).get(COOKIE_NAME);
    const session = await this.verifySession(sessionToken);
    if (!session) throw ForbiddenError("A verified email session is required");

    const user = await db.getUserByOpenId(session.openId);
    if (!user) throw ForbiddenError("Verified email session has no Maya user record");

    await db.upsertUser({ openId: user.openId, lastSignedIn: new Date() });
    return user;
  }
}

export type AuthenticatedUser = User;
export const sdk = new SDKServer();
