// VaaniLens client analytics — fire-and-forget beacons to /api/track.
// No cookies, no fingerprints. The server records city/device from Vercel edge headers;
// here we only send the event name, the path, the referrer and any utm_source.
export type TrackEvent =
  | 'page_view' | 'cta_click' | 'demo_sample_played' | 'mic_used'
  | 'upload_used' | 'transcribe' | 'speak' | 'waitlist_signup';

export function track(event: TrackEvent, extra?: Record<string, unknown>): void {
  try {
    const params = new URLSearchParams(location.search);
    const body = JSON.stringify({
      event,
      path: location.pathname + location.search,
      referrer: document.referrer || '',
      utm_source: params.get('utm_source') || '',
      ...(extra ? { extra } : {}),
    });
    const blob = new Blob([body], { type: 'application/json' });
    if (navigator.sendBeacon && navigator.sendBeacon('/api/track', blob)) return;
    fetch('/api/track', { method: 'POST', body, headers: { 'Content-Type': 'application/json' }, keepalive: true }).catch(() => {});
  } catch { /* analytics must never break the page */ }
}

// Record a page_view once the page is ready.
export function trackPageView(): void { track('page_view'); }
