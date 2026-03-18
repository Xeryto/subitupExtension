// Runs in the PAGE's main world (world: "MAIN" in manifest)
// Patches XHR/fetch to intercept SubItUp API responses
// Sends data to the content script via window.postMessage

function isScheduleUrl(url: string): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  return (
    lower.includes('subitup.com') &&
    (lower.includes('getemployeeschedule') ||
     lower.includes('/schedule') ||
     lower.includes('/api/employee'))
  );
}

function sendToExtension(data: unknown) {
  window.postMessage({ type: '__SUBITUP_SYNC_DATA__', data }, '*');
}

// Patch XHR
const origOpen = XMLHttpRequest.prototype.open;
const origSend = XMLHttpRequest.prototype.send;

XMLHttpRequest.prototype.open = function (method: string, url: string | URL, ...rest: any[]) {
  (this as any).__subitupUrl = String(url);
  return origOpen.apply(this, [method, url, ...rest] as any);
};

XMLHttpRequest.prototype.send = function (body?: Document | XMLHttpRequestBodyInit | null) {
  const url = (this as any).__subitupUrl;
  if (isScheduleUrl(url)) {
    this.addEventListener('load', function () {
      try {
        const data = JSON.parse(this.responseText);
        sendToExtension(data);
      } catch {}
    });
  }
  return origSend.call(this, body);
};

// Patch fetch
const origFetch = window.fetch;
window.fetch = async function (...args: Parameters<typeof fetch>) {
  const response = await origFetch.apply(this, args);
  try {
    const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request).url;
    if (isScheduleUrl(url)) {
      response.clone().json().then(data => {
        sendToExtension(data);
      }).catch(() => {});
    }
  } catch {}
  return response;
};
