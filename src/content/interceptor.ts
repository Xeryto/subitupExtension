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

interface ViewedRange { from: string; to: string }

function parseViewedRange(bodyStr: string | null | undefined): ViewedRange | null {
  if (!bodyStr || typeof bodyStr !== 'string') return null;
  try {
    const obj = JSON.parse(bodyStr);
    const from = parseSubitupDate(obj.startdate);
    const to = parseSubitupDate(obj.enddate);
    if (from && to) return { from, to };
  } catch {}
  return null;
}

// Convert SubItUp "MM-DD-YYYY" → "YYYY-MM-DD"
function parseSubitupDate(val: unknown): string | null {
  if (typeof val !== 'string') return null;
  const parts = val.split('-');
  if (parts.length !== 3 || parts[2].length !== 4) return null;
  return `${parts[2]}-${parts[0]}-${parts[1]}`;
}

function sendToExtension(data: unknown, viewedRange: ViewedRange | null) {
  window.postMessage({ type: '__SUBITUP_SYNC_DATA__', data, viewedRange }, '*');
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
    const viewedRange = parseViewedRange(typeof body === 'string' ? body : null);
    this.addEventListener('load', function () {
      try {
        const data = JSON.parse(this.responseText);
        sendToExtension(data, viewedRange);
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
      const bodyStr = typeof (args[1] as RequestInit | undefined)?.body === 'string'
        ? (args[1] as RequestInit).body as string
        : null;
      const viewedRange = parseViewedRange(bodyStr);
      response.clone().json().then(data => {
        sendToExtension(data, viewedRange);
      }).catch(() => {});
    }
  } catch {}
  return response;
};
