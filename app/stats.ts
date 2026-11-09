// VaaniLens /stats — private demo-users list only. The key lives in sessionStorage only and is
// sent solely to our own /api/stats. Raw events stay in Blob but aren't shown here.
type Visitor = {
  linkedin: string; city: string; region: string; country: string; device: string; browser: string;
  first_seen: string; last_seen: string; visits: number; used: { transcribe: boolean; speak: boolean };
};
type Stats = { generated_at: string; visitor_count: number; visitors: Visitor[] };

const $ = (id: string) => document.getElementById(id)!;
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
const fmt = (t: string) => { try { return t ? new Date(t).toLocaleString() : '—'; } catch { return '—'; } };
let KEY = '';
let ALL: Visitor[] = [];

const SS = {
  get: () => { try { return sessionStorage.getItem('vl_stats_key') || ''; } catch { return ''; } },
  set: (v: string) => { try { sessionStorage.setItem('vl_stats_key', v); } catch { /* ignore */ } },
};

async function load(key: string): Promise<Stats> {
  const r = await fetch(`/api/stats?key=${encodeURIComponent(key)}`);
  if (r.status === 401) throw new Error('Wrong key (or STATS_KEY not set on the server).');
  if (!r.ok) throw new Error(`Server error (${r.status}).`);
  return (await r.json()) as Stats;
}

function rowHtml(v: Visitor): string {
  const yn = (b: boolean) => (b ? '<span class="yes">yes</span>' : '<span class="no">no</span>');
  return `<tr>
    <td><a class="li" href="${esc(v.linkedin)}" target="_blank" rel="noopener">${esc(v.linkedin.replace(/^https?:\/\//, ''))}</a></td>
    <td>${esc(v.city) || '<span class="mut">—</span>'}</td>
    <td>${esc(v.country) || '<span class="mut">—</span>'}</td>
    <td>${esc(v.device) || '<span class="mut">—</span>'}</td>
    <td class="mut">${esc(fmt(v.first_seen))}</td>
    <td class="mut">${esc(fmt(v.last_seen))}</td>
    <td class="num">${v.visits}</td>
    <td>${yn(v.used.transcribe)}</td>
    <td>${yn(v.used.speak)}</td>
  </tr>`;
}

function render(list: Visitor[]) {
  $('count').textContent = `${list.length} user${list.length === 1 ? '' : 's'}`;
  $('rows').innerHTML = list.length ? list.map(rowHtml).join('') : `<tr><td colspan="9" class="mut">No demo users yet.</td></tr>`;
}

function applySearch() {
  const q = ($('search') as HTMLInputElement).value.trim().toLowerCase();
  if (!q) return render(ALL);
  render(ALL.filter((v) => [v.linkedin, v.city, v.country, v.device, v.browser].join(' ').toLowerCase().includes(q)));
}

async function show(key: string) {
  const gateMsg = $('gateMsg'); gateMsg.textContent = '';
  try {
    const s = await load(key);
    KEY = key; SS.set(key); ALL = s.visitors || [];
    $('gate').classList.add('hidden'); $('dash').classList.remove('hidden');
    applySearch();
  } catch (e) { gateMsg.textContent = (e as Error).message; }
}

$('loadBtn').addEventListener('click', () => show(($('keyInput') as HTMLInputElement).value.trim()));
$('keyInput').addEventListener('keydown', (e) => { if ((e as KeyboardEvent).key === 'Enter') show(($('keyInput') as HTMLInputElement).value.trim()); });
$('refreshBtn').addEventListener('click', () => show(KEY));
$('search').addEventListener('input', applySearch);
$('downloadBtn').addEventListener('click', () => { window.location.href = `/api/stats?key=${encodeURIComponent(KEY)}&format=json-download`; });

const remembered = SS.get();
if (remembered) { ($('keyInput') as HTMLInputElement).value = remembered; show(remembered); }
