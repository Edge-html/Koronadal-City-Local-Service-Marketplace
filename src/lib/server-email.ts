type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

/** Sends transactional email through Resend. Secrets stay on the server. */
export async function sendTransactionalEmail(message: EmailMessage) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    console.warn("[email] not sent: configure RESEND_API_KEY and EMAIL_FROM.");
    return false;
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ...message, from }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) {
      console.error(`[email] provider returned HTTP ${response.status}.`);
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
