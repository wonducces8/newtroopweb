const cfg = window.TROOP_CONFIG || {};
const grid = document.querySelector('#photo-gallery');
const status = document.querySelector('#gallery-status');
const button = document.querySelector('#shuffle-photos');
const folderSelect = document.querySelector('#gallery-folder');
const client = cfg.supabaseUrl && cfg.supabasePublishableKey ? await (window.TROOP_SUPABASE_PROMISE || (window.TROOP_SUPABASE_PROMISE = import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm').then(({createClient}) => createClient(cfg.supabaseUrl, cfg.supabasePublishableKey)))).catch(() => null) : null;
let photos = [];
let activeFolder = '';
function escapeHtml(value) { return String(value || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function shuffle() {
  for (let i = photos.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [photos[i], photos[j]] = [photos[j], photos[i]]; }
}
function render() {
  const visible = photos.filter(photo => !activeFolder || photo.folder_name === activeFolder);
  const groups = new Map();
  visible.forEach(photo => { if (!groups.has(photo.folder_name)) groups.set(photo.folder_name, []); groups.get(photo.folder_name).push(photo); });
  grid.innerHTML = Array.from(groups, ([folder, items]) => '<section class="photo-album"><h2>' + escapeHtml(folder) + '</h2><div class="photo-grid">' + items.map(photo => '<figure class="photo-tile"><img src="' + escapeHtml(photo.url) + '" alt="' + escapeHtml(photo.caption || 'Troop 1941 activity photo') + '" loading="lazy">' + (photo.caption ? '<figcaption>' + escapeHtml(photo.caption) + '</figcaption>' : '') + '</figure>').join('') + '</div></section>').join('');
}
async function load() {
  if (!client) { status.textContent = 'The photo library is not connected yet.'; return; }
  const [folderResult, photoResult] = await Promise.all([
    client.from('photo_folders').select('name').order('name'),
    client.from('photo_library').select('path,folder_name,caption,created_at').order('created_at', {ascending:false}).limit(250)
  ]);
  if (folderResult.error || photoResult.error) { status.textContent = 'Photo library is still being set up. Please try again later.'; return; }
  const folders = folderResult.data || [];
  photos = (photoResult.data || []).map(photo => ({...photo,url:client.storage.from('troop-photos').getPublicUrl(photo.path).data.publicUrl}));
  folderSelect.innerHTML = '<option value="">All albums</option>' + folders.map(folder => '<option value="' + escapeHtml(folder.name) + '">' + escapeHtml(folder.name) + '</option>').join('');
  if (!photos.length) { status.textContent = 'No photos have been added yet. Check back after the troop admin uploads some.'; return; }
  status.hidden = true; button.hidden = false; folderSelect.hidden = false;
  shuffle(); render();
}
folderSelect.addEventListener('change', () => { activeFolder = folderSelect.value; render(); });
button.addEventListener('click', () => { if (photos.length > 1) { shuffle(); render(); } });
button.hidden = true; folderSelect.hidden = true; load();
