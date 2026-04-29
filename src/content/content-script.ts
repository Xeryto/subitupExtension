// Listen for intercepted data from the MAIN world interceptor
window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  if (event.data?.type === '__SUBITUP_SYNC_DATA__' && event.data.data) {
    chrome.runtime.sendMessage({ type: 'INTERCEPTED_DATA', data: event.data.data, viewedRange: event.data.viewedRange ?? null });
  }
});

// Notify service worker that user is on SubItUp
chrome.runtime.sendMessage({ type: 'SUBITUP_PAGE_LOADED' });

// --- Floating widget (inject when DOM ready) ---
function injectWidget() {
  const ICON_SIZE = 44;

  const btn = document.createElement('button');
  btn.id = 'subitup-sync-fab';
  btn.title = 'SubItUp Sync';
  btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;
  Object.assign(btn.style, {
    position: 'fixed',
    right: '16px',
    bottom: '16px',
    width: `${ICON_SIZE}px`,
    height: `${ICON_SIZE}px`,
    borderRadius: '50%',
    backgroundColor: '#0891B2',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: '2147483646',
    boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
    transition: 'transform 150ms ease, box-shadow 150ms ease',
    padding: '0',
  });
  btn.addEventListener('mouseenter', () => {
    btn.style.transform = 'scale(1.08)';
    btn.style.boxShadow = '0 4px 12px rgba(0,0,0,0.25)';
  });
  btn.addEventListener('mouseleave', () => {
    btn.style.transform = 'scale(1)';
    btn.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
  });

  const panel = document.createElement('div');
  panel.id = 'subitup-sync-panel';
  Object.assign(panel.style, {
    position: 'fixed',
    right: '16px',
    bottom: `${ICON_SIZE + 24}px`,
    width: '360px',
    height: '520px',
    borderRadius: '12px',
    overflow: 'hidden',
    backgroundColor: '#ECFEFF',
    boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
    zIndex: '2147483647',
    display: 'none',
    transition: 'opacity 150ms ease, transform 150ms ease',
    opacity: '0',
    transform: 'translateY(8px)',
  });

  const iframe = document.createElement('iframe');
  iframe.src = chrome.runtime.getURL('popup.html');
  Object.assign(iframe.style, { width: '100%', height: '100%', border: 'none', borderRadius: '12px' });
  panel.appendChild(iframe);

  let open = false;

  btn.addEventListener('click', () => {
    open = !open;
    if (open) {
      panel.style.display = 'block';
      panel.offsetHeight; // force reflow
      panel.style.opacity = '1';
      panel.style.transform = 'translateY(0)';
    } else {
      panel.style.opacity = '0';
      panel.style.transform = 'translateY(8px)';
      setTimeout(() => { panel.style.display = 'none'; }, 150);
    }
  });

  document.addEventListener('click', (e) => {
    if (open && !panel.contains(e.target as Node) && e.target !== btn && !btn.contains(e.target as Node)) {
      open = false;
      panel.style.opacity = '0';
      panel.style.transform = 'translateY(8px)';
      setTimeout(() => { panel.style.display = 'none'; }, 150);
    }
  });

  document.body.appendChild(btn);
  document.body.appendChild(panel);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', injectWidget);
} else {
  injectWidget();
}
