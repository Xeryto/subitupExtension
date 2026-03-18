// Centralized safe wrappers for chrome APIs that throw when extension context
// is invalidated (e.g. after an extension reload while the iframe popup is open).

let onContextInvalidated: (() => void) | null = null;

export function registerInvalidationHandler(cb: () => void): void {
  onContextInvalidated = cb;
}

function signalIfInvalidated(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : (e as any)?.message ?? String(e);
  if (msg?.includes('Extension context invalidated')) {
    onContextInvalidated?.();
    return true;
  }
  return false;
}

export function safeSendMessage(message: object, callback: (res: any) => void): void {
  try {
    chrome.runtime.sendMessage(message, (res) => {
      if (chrome.runtime.lastError) {
        if (signalIfInvalidated(chrome.runtime.lastError)) return;
      }
      callback(res);
    });
  } catch (e) {
    signalIfInvalidated(e);
  }
}

export function safeStorageGet(key: string | string[], callback: (result: any) => void): void {
  try {
    chrome.storage.local.get(key, callback);
  } catch (e) {
    signalIfInvalidated(e);
  }
}

export function safeStorageSet(items: object): void {
  try {
    chrome.storage.local.set(items);
  } catch (e) {
    signalIfInvalidated(e);
  }
}
