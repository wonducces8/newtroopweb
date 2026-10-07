const cfg = window.TROOP_CONFIG || {};
const grid = document.querySelector('#photo-gallery');
const status = document.querySelector('#gallery-status');
const button = document.querySelector('#shuffle-photos');
const client = cfg.supabaseUrl && cfg.supabasePublishableKey ? await (window.TROOP_SUPABASE_PROMISE || (window.TROOP_SUPABASE_PROMISE = import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm').then(({createClient}) => createClient(cfg.supabaseUrl, cfg.supabasePublishableKey)))).catch(() => null) : null;
const bucket = 'troop-photos';
let photos = [];
function escapeHtml(value) { return String(value || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function shuffle() {
  for (let i = photos.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [photos[i], photos[j]] = [photos[j], photos[i]]; }
}
function render() {
  grid.innerHTML = photos.map((photo, index) => '<figure class="photo-tile"><img src="' + escapeHtml(photo.url) + '" alt="Troop 1941 activity photo ' + (index + 1) + '" loading="lazy"><figcaption>OUT THERE, TOGETHER</figcaption></figure>').join('');
}
async function load() {
  if (!client) { status.textContent = 'The photo library is not connected yet.'; return; }
  const result = await client.storage.from(bucket).list('', {limit: 100, sortBy: {column: 'created_at', order: 'desc'}});
  if (result.error) { status.textContent = 'Photo library is still being set up.'; return; }
  photos = (result.data || []).filter(file => file.name && !file.name.startsWith('.')).map(file => ({name:file.name,url:client.storage.from(bucket).getPublicUrl(file.name).data.publicUrl}));
  if (!photos.length) { status.textContent = 'No photos have been added yet. Check back after the troop admin uploads some.'; return; }
  status.hidden = true; button.hidden = false; shuffle(); render();
}
button.addEventListener('click', () => { if (photos.length > 1) { shuffle(); render(); } });
button.hidden = true; load();
