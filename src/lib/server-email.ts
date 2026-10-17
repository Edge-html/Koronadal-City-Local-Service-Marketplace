type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

export type EmailSendResult =
  | { ok: true }
  | { ok: false; reason: "not_configured" | "http_error" | "unauthorized" | "quota_reached" | "invalid_message" | "relay_error" | "invalid_response" | "unreachable" };

export function emailRelayConfigured() {
  return emailRelayMissingVariables().length === 0;
}

export function emailRelayMissingVariables() {
  return [
    !process.env.GOOGLE_APPS_SCRIPT_URL?.trim() ? "GOOGLE_APPS_SCRIPT_URL" : null,
    !process.env.GOOGLE_APPS_SCRIPT_SECRET?.trim() ? "GOOGLE_APPS_SCRIPT_SECRET" : null,
  ].filter((name): name is string => name !== null);
}

/** Sends transactional email through the private Google Apps Script relay. */
export async function sendTransactionalEmailDetailed(message: EmailMessage): Promise<EmailSendResult> {
  const scriptUrl = process.env.GOOGLE_APPS_SCRIPT_URL?.trim();
  const secret = process.env.GOOGLE_APPS_SCRIPT_SECRET?.trim();
  if (!scriptUrl || !secret) {
    console.warn("[email] not sent: configure Google Apps Script email relay variables.");
    return { ok: false, reason: "not_configured" };
  }

  try {
    const response = await fetch(scriptUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...message, secret }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) {
      console.error(`[email] provider returned HTTP ${response.status}.`);
      return { ok: false, reason: "http_error" };
    }
    const result = await response.json().catch(() => null) as { ok?: boolean; error?: string } | null;
    if (!result?.ok) {
      const reason = result?.error === "Unauthorized" ? "unauthorized"
        : result?.error === "Daily email quota reached" ? "quota_reached"
        : result?.error === "Invalid email message" ? "invalid_message"
        : result ? "relay_error" : "invalid_response";
      console.error(`[email] Google Apps Script rejected the message: ${reason}.`);
      return { ok: false, reason };
    }
    return { ok: true };
  } catch (error) {
    console.error("[email] delivery request failed.", error);
    return { ok: false, reason: "unreachable" };
  }
}

export async function sendTransactionalEmail(message: EmailMessage) {
  return (await sendTransactionalEmailDetailed(message)).ok;
}

export function escapeEmailHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]!);
}
