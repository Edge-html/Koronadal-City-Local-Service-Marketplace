import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { adminServices } from "@/lib/firebase-admin";
import { escapeEmailHtml, sendTransactionalEmailDetailed } from "@/lib/server-email";

export const runtime = "nodejs";

const RESET_GENERIC_RESPONSE = {
  ok: true,
  message: "If an account exists for that email, a password reset link will be sent.",
};
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const KOROHANAP_ORIGIN = (process.env.NEXT_PUBLIC_APP_URL || "https://kclsm.vercel.app").replace(/\/$/, "");

function response(value: unknown, status = 200) {
  return NextResponse.json(value, { status, headers: { "cache-control": "no-store" } });
}

function rateLimitDocumentId(key: string) {
  return createHash("sha256").update(key.trim().toLowerCase()).digest("hex");
}

async function takeRateLimit(
  db: FirebaseFirestore.Firestore,
  key: string,
  maximum: number,
  windowMs: number,
) {
  const ref = db.collection("authEmailRateLimits").doc(rateLimitDocumentId(key));
  const now = Date.now();
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const current = snapshot.data();
    const windowStartedAt = Number(current?.windowStartedAt ?? 0);
    const count = Number(current?.count ?? 0);
    if (windowStartedAt && now - windowStartedAt < windowMs && count >= maximum) return false;
    transaction.set(ref, windowStartedAt && now - windowStartedAt < windowMs
      ? { windowStartedAt, count: count + 1, updatedAt: now }
      : { windowStartedAt: now, count: 1, updatedAt: now });
    return true;
  });
}

function requestIp(request: NextRequest) {
  return request.headers.get("x-real-ip")
    || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || "unknown";
}

/**
 * Firebase's default action page is hosted on the Firebase project's
 * firebaseapp.com domain. Point the one-time action code at our own handler so
 * verification and password reset still work when that hosted page is not
 * reachable.
 */
function korohanapActionLink(firebaseLink: string, expectedMode: "verifyEmail" | "resetPassword") {
  const generated = new URL(firebaseLink);
  const mode = generated.searchParams.get("mode");
  const oobCode = generated.searchParams.get("oobCode");
  const apiKey = generated.searchParams.get("apiKey");
  if (mode !== expectedMode || !oobCode || !apiKey) {
    throw new Error("Firebase generated an invalid email action link.");
  }

  const action = new URL("/auth/action", `${KOROHANAP_ORIGIN}/`);
  action.searchParams.set("mode", mode);
  action.searchParams.set("oobCode", oobCode);
  action.searchParams.set("apiKey", apiKey);
  const lang = generated.searchParams.get("lang");
  if (lang) action.searchParams.set("lang", lang);
  return action.toString();
}

function authEmailHtml(input: {
  heading: string;
  greeting: string;
  detail: string;
  button: string;
  actionLink: string;
  footer: string;
}) {
  const greeting = escapeEmailHtml(input.greeting);
  const heading = escapeEmailHtml(input.heading);
  const detail = escapeEmailHtml(input.detail);
  const button = escapeEmailHtml(input.button);
  const link = escapeEmailHtml(input.actionLink);
  const footer = escapeEmailHtml(input.footer);
  return `<!doctype html><html><body style="margin:0;background:#f1f6ff;font-family:Arial,Helvetica,sans-serif;color:#14243c"><div style="padding:32px 12px"><div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #d6e3f4;border-radius:16px;overflow:hidden"><div style="padding:22px 28px;background:#0b3673;color:#ffffff;font-size:18px;font-weight:700">KoroHanap</div><div style="padding:32px 28px"><p style="margin:0 0 8px;color:#4c6381">Hi ${greeting},</p><h1 style="margin:0 0 14px;font-size:24px;line-height:1.3;color:#102b56">${heading}</h1><p style="margin:0 0 24px;line-height:1.65;color:#334963">${detail}</p><p style="margin:0 0 24px"><a href="${link}" style="display:inline-block;padding:13px 21px;border-radius:8px;background:#0b63ce;color:#ffffff;font-weight:700;text-decoration:none">${button}</a></p><p style="margin:0 0 12px;font-size:13px;line-height:1.6;color:#60748e">If the button does not work, copy and paste this link into your browser:<br><a href="${link}" style="color:#0b63ce;word-break:break-all">${link}</a></p><p style="margin:24px 0 0;padding-top:18px;border-top:1px solid #e7eef7;font-size:12px;line-height:1.6;color:#718096">${footer}</p></div></div><p style="max-width:560px;margin:14px auto 0;text-align:center;font-size:11px;color:#718096">Koronadal City Local Service Marketplace</p></div></body></html>`;
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as { operation?: string; email?: string } | null;
  if (body?.operation === "passwordReset") return sendPasswordReset(request, String(body.email ?? ""));
  if (body?.operation === "verification") return sendVerification(request);
  return response({ error: "Choose a valid email action." }, 400);
}

async function sendPasswordReset(request: NextRequest, rawEmail: string) {
  const email = rawEmail.trim().toLowerCase();
  if (!EMAIL_PATTERN.test(email) || email.length > 254) return response(RESET_GENERIC_RESPONSE);

  try {
    const { auth, db } = adminServices();
    const ip = requestIp(request);
    const [emailAllowed, ipAllowed] = await Promise.all([
      takeRateLimit(db, `password-reset-email:${email}`, 2, 15 * 60 * 1000),
      takeRateLimit(db, `password-reset-ip:${ip}`, 12, 15 * 60 * 1000),
    ]);
    if (!emailAllowed || !ipAllowed) return response(RESET_GENERIC_RESPONSE);

    let user;
    try { user = await auth.getUserByEmail(email); }
    catch (error) {
      if ((error as { code?: string })?.code === "auth/user-not-found") return response(RESET_GENERIC_RESPONSE);
      throw error;
    }
    if (user.disabled) return response(RESET_GENERIC_RESPONSE);

    const firebaseLink = await auth.generatePasswordResetLink(user.email ?? email);
    const actionLink = korohanapActionLink(firebaseLink, "resetPassword");
    const name = user.displayName?.trim() || "there";
    const detail = "We received a request to reset your KoroHanap password. Use the secure link below to choose a new password.";
    const html = authEmailHtml({
      heading: "Reset your password",
      greeting: name,
      detail,
      button: "Choose a new password",
      actionLink,
      footer: "If you did not request a password reset, you can ignore this email. Your password will not change unless you open the link and choose a new one.",
    });
    const sent = await sendTransactionalEmailDetailed({
      to: user.email ?? email,
      subject: "Reset your KoroHanap password",
      text: `Hi ${name}, ${detail} Reset your password here: ${actionLink}\n\nIf you did not request this, ignore this email.`,
      html,
    });
    if (!sent.ok) console.error(`[auth-email] password reset email was not delivered (${sent.reason}).`);
  } catch (error) {
    console.error("[auth-email] password reset request failed.", error);
  }
  // Always return the same response so callers cannot discover registered emails.
  return response(RESET_GENERIC_RESPONSE);
}

async function sendVerification(request: NextRequest) {
  try {
    const { auth, db } = adminServices();
    const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) return response({ error: "Sign in to request a verification email." }, 401);
    const caller = await auth.verifyIdToken(token);
    const user = await auth.getUser(caller.uid);
    if (user.disabled || !user.email) return response({ error: "This account cannot receive a verification email." }, 400);
    if (user.emailVerified) return response({ error: "This email is already verified." }, 400);

    const [userAllowed, ipAllowed] = await Promise.all([
      takeRateLimit(db, `verification-user:${user.uid}`, 1, 60 * 1000),
      takeRateLimit(db, `verification-ip:${requestIp(request)}`, 20, 15 * 60 * 1000),
    ]);
    if (!userAllowed || !ipAllowed) return response({ error: "Please wait a minute before requesting another verification email." }, 429);

    const firebaseLink = await auth.generateEmailVerificationLink(user.email);
    const actionLink = korohanapActionLink(firebaseLink, "verifyEmail");
    const name = user.displayName?.trim() || "there";
    const detail = "Confirm your email address to finish setting up your KoroHanap account.";
    const html = authEmailHtml({
      heading: "Verify your email address",
      greeting: name,
      detail,
      button: "Verify email address",
      actionLink,
      footer: "If you did not create a KoroHanap account, you can ignore this email.",
    });
    const sent = await sendTransactionalEmailDetailed({
      to: user.email,
      subject: "Verify your KoroHanap email address",
      text: `Hi ${name}, ${detail} Verify your email here: ${actionLink}\n\nIf you did not create a KoroHanap account, ignore this email.`,
      html,
    });
    if (!sent.ok) {
      console.error(`[auth-email] verification email was not delivered (${sent.reason}).`);
      return response({ error: "KoroHanap could not send the verification email. Check the email relay settings and try again." }, 503);
    }
    return response({ ok: true });
  } catch (error) {
    console.error("[auth-email] verification email request failed.", error);
    return response({ error: "Could not send the verification email. Please try again." }, 500);
  }
}
