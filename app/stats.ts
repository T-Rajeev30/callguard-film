// VaaniLens stats dashboard — fetches /api/stats?key=… and renders cards, a funnel, tables.
// The key is held in memory only (and sessionStorage for convenience); never sent anywhere but our API.
type Pair = { key: string; count: number };
type Stats = {
  generated_at: string; total_events: number; totals: Record<string, number>;
  per_day: { day: string; count: number }[];
  top_cities: Pair[]; countries: Pair[]; referrers: Pair[]; utm_source: Pair[]; devices: Pair[]; browsers: Pair[];
  funnel: { step: string; count: number }[];
  waitlist_count: number; waitlist: { t: string; name: string; email: string; business: string; city: string; country: string }[];
  latest_events: Record<string, unknown>[];
};

const $ = (id: string) => document.getElementById(id)!;
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
let KEY = '';

const SS = {
  get: () => { try { return sessionStorage.getItem('vl_stats_key') || ''; } catch { return ''; } },
  set: (v: string) => { try { sessionStorage.setItem('vl_stats_key', v); } catch { /* ignore */ } },
};

async function load(key: string) {
  const r = await fetch(`/api/stats?key=${encodeURIComponent(key)}`);
  if (r.status === 401) throw new Error('Wrong key (or STATS_KEY not set on the server).');
  if (!r.ok) throw new Error(`Server error (${r.status}).`);
  return (await r.json()) as Stats;
}

function pairTable(title: string, rows: Pair[], col = 'Value'): string {
  const body = rows.length
    ? rows.map((p) => `<tr><td>${esc(p.key)}</td><td class="num">${p.count}</td></tr>`).join('')
    : `<tr><td class="muted" colspan="2">No data yet</td></tr>`;
  return `<div class="panel"><h3>${esc(title)}</h3><table><thead><tr><th>${esc(col)}</th><th class="num">Count</th></tr></thead><tbody>${body}</tbody></table></div>`;
}

function render(s: Stats) {
  $('genAt').textContent = `generated ${new Date(s.generated_at).toLocaleString()}`;

  // totals cards
  const totalRows = Object.entries(s.totals).sort((a, b) => b[1] - a[1]);
  $('totals').innerHTML =
    `<div class="card"><div class="n">${s.total_events}</div><div class="k">Total events</div></div>` +
    `<div class="card"><div class="n">${s.waitlist_count}</div><div class="k">Waitlist</div></div>` +
    totalRows.map(([k, v]) => `<div class="card"><div class="n">${v}</div><div class="k">${esc(k)}</div></div>`).join('');

  // funnel
  const max = Math.max(1, ...s.funnel.map((f) => f.count));
  $('funnel').innerHTML = s.funnel.map((f) => {
    const pct = Math.round((f.count / max) * 100);
    return `<div class="row"><div class="lab"><span>${esc(f.step)}</span><span class="muted">${f.count}</span></div>
      <div class="track"><div class="bar" style="width:${Math.max(pct, f.count ? 4 : 0)}%"></div></div></div>`;
  }).join('');

  // breakdown panels
  $('breakdown').innerHTML = [
    pairTable('Top cities', s.top_cities, 'City'),
    pairTable('Countries', s.countries, 'Country'),
    pairTable('Referrers', s.referrers, 'Host'),
    pairTable('UTM source', s.utm_source, 'Source'),
    pairTable('Devices', s.devices, 'Device'),
    pairTable('Browsers', s.browsers, 'Browser'),
    pairTable('Per day', s.per_day.map((d) => ({ key: d.day, count: d.count })), 'Day'),
  ].join('');

  // waitlist
  $('wlCount').textContent = String(s.waitlist_count);
  $('waitlist').innerHTML = s.waitlist.length
    ? `<thead><tr><th>When</th><th>Name</th><th>Email</th><th>Business</th><th>City</th></tr></thead><tbody>` +
      s.waitlist.map((w) => `<tr><td class="muted">${esc(new Date(w.t).toLocaleString())}</td><td>${esc(w.name)}</td><td>${esc(w.email)}</td><td>${esc(w.business)}</td><td>${esc(w.city)}</td></tr>`).join('') + `</tbody>`
    : `<tbody><tr><td class="muted">No signups yet</td></tr></tbody>`;

  // latest events
  $('events').innerHTML = s.latest_events.length
    ? `<thead><tr><th>When</th><th>Event</th><th>Path</th><th>City</th><th>Device</th><th>Ref</th></tr></thead><tbody>` +
      s.latest_events.map((e: any) => `<tr><td class="muted">${esc(new Date(e.t).toLocaleString())}</td><td>${esc(e.event)}</td><td class="muted">${esc(e.path)}</td><td>${esc(e.city)}</td><td>${esc(e.device)}</td><td class="muted">${esc(e.referrer)}</td></tr>`).join('') + `</tbody>`
    : `<tbody><tr><td class="muted">No events yet</td></tr></tbody>`;
}

async function show(key: string) {
  const gateMsg = $('gateMsg');
  gateMsg.textContent = '';
  try {
    const s = await load(key);
    KEY = key; SS.set(key);
    $('gate').classList.add('hidden');
    $('dash').classList.remove('hidden');
    render(s);
  } catch (e) {
    gateMsg.textContent = (e as Error).message;
  }
}

$('loadBtn').addEventListener('click', () => show(($('keyInput') as HTMLInputElement).value.trim()));
$('keyInput').addEventListener('keydown', (e) => { if ((e as KeyboardEvent).key === 'Enter') show(($('keyInput') as HTMLInputElement).value.trim()); });
$('refreshBtn').addEventListener('click', () => show(KEY));
$('downloadBtn').addEventListener('click', () => { window.location.href = `/api/stats?key=${encodeURIComponent(KEY)}&format=json-download`; });

// auto-load if a key is remembered from this session
const remembered = SS.get();
if (remembered) { ($('keyInput') as HTMLInputElement).value = remembered; show(remembered); }
