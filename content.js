const SUPABASE_CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
let contentClientPromise;
function getContentClient() {
  if (!contentClientPromise) contentClientPromise = import(SUPABASE_CDN).then(({ createClient }) => {
    const cfg = window.TROOP_CONFIG || {};
    if (!cfg.supabaseUrl || !cfg.supabasePublishableKey) return null;
    return createClient(cfg.supabaseUrl, cfg.supabasePublishableKey);
  }).catch(() => null);
  return contentClientPromise;
}
async function getTroopContent(key) {
  const client = await getContentClient();
  if (!client) return null;
  const { data, error } = await client.from('troop_content').select('value').eq('key', key).maybeSingle();
  if (error) return null;
  return data ? data.value : null;
}
function safeText(value) {
  return String(value || '').replace(/[&<>"']/g, function (c) {
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
  });
}
function renderRoster(selector, rows, emptyMessage, isPatrol) {
  const target = document.querySelector(selector);
  if (!target) return;
  if (!Array.isArray(rows) || !rows.length) {
    target.innerHTML = '<p class="notice">' + emptyMessage + '</p>';
    return;
  }
  target.innerHTML = rows.map(function (row) {
    if (isPatrol) return '<article class="patrol-card"><h3>' + safeText(row.name) + '</h3><p>' + safeText(row.description || '') + (row.leader ? ' · Patrol leader: ' + safeText(row.leader) : '') + '</p></article>';
    return '<div class="leader-row"><span>' + safeText(row.role) + '</span><b>' + safeText(row.name) + '</b></div>';
  }).join('');
}
async function loadRoster() {
  const results = await Promise.all([getTroopContent('patrols'), getTroopContent('leaders')]);
  renderRoster('#patrol-list', results[0], 'Current patrol details will appear here after an administrator adds them.', true);
  renderRoster('#leader-list', results[1], 'Current leadership details will appear here after an administrator adds them.', false);
}
if (document.querySelector('#patrol-list, #leader-list')) loadRoster();
