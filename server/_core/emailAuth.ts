import type { Express } from "express";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import * as db from "../db";
import { getSupabaseServerClient } from "../supabaseConfig";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";

export function normalizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function displayNameForEmail(email: string) {
  return email.split("@")[0]?.replace(/[._-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) || "Friend";
}

function publicOrigin(req: { protocol: string; get(name: string): string | undefined }) {
  const host = req.get("host");
  if (!host) throw new Error("Maya could not determine the verification return address.");
  return `${req.protocol}://${host}`;
}

export function registerEmailAuthRoutes(app: Express) {
  app.post("/api/auth/request-email-verification", async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      res.status(400).json({ error: "Enter a valid email address." });
      return;
    }

    const { error } = await getSupabaseServerClient().auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true, emailRedirectTo: publicOrigin(req) },
    });
    if (error) {
      res.status(400).json({ error: "Maya could not send that verification email. Please try again." });
      return;
    }
    res.json({ success: true });
  });

  app.post("/api/auth/complete-email-verification", async (req, res) => {
    const accessToken = typeof req.body?.accessToken === "string" ? req.body.accessToken : "";
    if (!accessToken) {
      res.status(400).json({ error: "The email verification link is incomplete." });
      return;
    }

    const { data, error } = await getSupabaseServerClient().auth.getUser(accessToken);
    const email = normalizeEmail(data.user?.email);
    if (error || !data.user || !email) {
      res.status(401).json({ error: "That verification link has expired. Request a new one." });
      return;
    }

    const name = typeof data.user.user_metadata?.full_name === "string" ? data.user.user_metadata.full_name : displayNameForEmail(email);
    await db.upsertUser({ openId: data.user.id, name, email, loginMethod: "email", lastSignedIn: new Date() });
    const token = await sdk.createEmailSessionToken(data.user.id, name);
    res.cookie(COOKIE_NAME, token, { ...getSessionCookieOptions(req), maxAge: ONE_YEAR_MS });
    res.json({ success: true });
  });
}
