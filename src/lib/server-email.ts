type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

/** Sends transactional email through the private Google Apps Script relay. */
export async function sendTransactionalEmail(message: EmailMessage) {
  const scriptUrl = process.env.GOOGLE_APPS_SCRIPT_URL;
  const secret = process.env.GOOGLE_APPS_SCRIPT_SECRET;
  if (!scriptUrl || !secret) {
    console.warn("[email] not sent: configure Google Apps Script email relay variables.");
    return false;
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
      return false;
    }
    const result = await response.json().catch(() => null) as { ok?: boolean } | null;
    if (!result?.ok) {
      console.error("[email] Google Apps Script did not accept the message.");
      return false;
    }
    return true;
  } catch (error) {
    console.error("[email] delivery request failed.", error);
    return false;
  }
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
