/**
 * Free KoroHanap email relay for Google Apps Script.
 *
 * Deploy as a Web app that executes as you. Store the same random secret in
 * Script Properties under KOROHANAP_EMAIL_SECRET and in Vercel as
 * GOOGLE_APPS_SCRIPT_SECRET. Do not put the secret in this source file.
 */
function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents || "{}");
    const expectedSecret = PropertiesService.getScriptProperties()
      .getProperty("KOROHANAP_EMAIL_SECRET");

    if (!expectedSecret || payload.secret !== expectedSecret) {
      return jsonResponse({ ok: false, error: "Unauthorized" });
    }

    const to = String(payload.to || "").trim();
    const subject = String(payload.subject || "").trim();
    const text = String(payload.text || "");
    const html = String(payload.html || "");
    if (!to || !subject || (!text && !html) || to.length > 254 || subject.length > 180) {
      return jsonResponse({ ok: false, error: "Invalid email message" });
    }

    if (MailApp.getRemainingDailyQuota() < 1) {
      return jsonResponse({ ok: false, error: "Daily email quota reached" });
    }

    MailApp.sendEmail({
      to: to,
      subject: subject,
      body: text || "Please view this message in an email app that supports HTML.",
      htmlBody: html || undefined,
      name: "KoroHanap",
    });
    return jsonResponse({ ok: true });
  } catch (error) {
    console.error("KoroHanap email send failed", error);
    return jsonResponse({ ok: false, error: "Email could not be sent" });
  }
}

function jsonResponse(value) {
  return ContentService
    .createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}
