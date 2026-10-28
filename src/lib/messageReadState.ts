const READ_EVENT = "korohanap:messages-read";

function storageKey(uid: string) {
  return `korohanap:message-read:${uid}`;
}

export function getConversationReadAt(uid: string, conversationId: string): number {
  if (typeof window === "undefined") return 0;
  try {
    const values = JSON.parse(localStorage.getItem(storageKey(uid)) ?? "{}") as Record<string, unknown>;
    return typeof values[conversationId] === "number" ? values[conversationId] : 0;
  } catch {
    return 0;
  }
}

export function markConversationRead(uid: string, conversationId: string) {
  if (typeof window === "undefined") return;
  try {
    const key = storageKey(uid);
    const values = JSON.parse(localStorage.getItem(key) ?? "{}") as Record<string, unknown>;
    values[conversationId] = Date.now();
    localStorage.setItem(key, JSON.stringify(values));
    window.dispatchEvent(new Event(READ_EVENT));
  } catch {
    // Messaging still works if the browser blocks local storage; only the
    // local unread badge state is unavailable in that case.
  }
}

export function addMessageReadStateListener(onChange: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(READ_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(READ_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}
