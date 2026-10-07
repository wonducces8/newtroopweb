const cfg = window.TROOP_CONFIG || {};
const grid = document.querySelector('#photo-gallery');
const status = document.querySelector('#gallery-status');
const button = document.querySelector('#shuffle-photos');
const folderSelect = document.querySelector('#gallery-folder');
const viewer = document.querySelector('#photo-viewer');
const viewerImage = document.querySelector('#viewer-image');
const viewerCaption = document.querySelector('#viewer-caption');
const client = cfg.supabaseUrl && cfg.supabasePublishableKey ? await (window.TROOP_SUPABASE_PROMISE || (window.TROOP_SUPABASE_PROMISE = import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm').then(({createClient}) => createClient(cfg.supabaseUrl, cfg.supabasePublishableKey)))).catch(() => null) : null;
let photos = [];
let activeFolder = '';
let viewerPhotos = [];
let viewerIndex = 0;
function escapeHtml(value) { return String(value || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function shuffle() {
  for (let i = photos.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [photos[i], photos[j]] = [photos[j], photos[i]]; }
}
function visiblePhotos() { return photos.filter(photo => !activeFolder || photo.folder_name === activeFolder); }
function render() {
  const visible = visiblePhotos();
  const groups = new Map();
  visible.forEach(photo => { if (!groups.has(photo.folder_name)) groups.set(photo.folder_name, []); groups.get(photo.folder_name).push(photo); });
  grid.innerHTML = Array.from(groups, ([folder, items]) => '<section class="photo-album"><div class="album-heading"><span>ALBUM</span><h2>' + escapeHtml(folder) + '</h2><small>' + items.length + (items.length === 1 ? ' photo' : ' photos') + '</small></div><div class="photo-grid">' + items.map(photo => {
    const index = visible.indexOf(photo);
    return '<figure class="photo-tile"><button class="photo-open" type="button" data-photo-index="' + index + '" aria-label="View photo full screen"><img src="' + escapeHtml(photo.url) + '" alt="' + escapeHtml(photo.caption || 'Troop 1941 activity photo') + '" loading="lazy"><span class="photo-expand" aria-hidden="true">⛶</span></button>' + (photo.caption ? '<figcaption>' + escapeHtml(photo.caption) + '</figcaption>' : '') + '</figure>';
  }).join('') + '</div></section>').join('');
}
function showViewer(index) {
  viewerPhotos = visiblePhotos();
  viewerIndex = Math.max(0, Math.min(index, viewerPhotos.length - 1));
  updateViewer();
  if (!viewer.open) viewer.showModal();
}
function updateViewer() {
  const photo = viewerPhotos[viewerIndex];
  if (!photo) return;
  viewerImage.src = photo.url;
  viewerImage.alt = photo.caption || 'Troop 1941 activity photo';
  viewerCaption.textContent = photo.caption || '';
  viewerCaption.hidden = !photo.caption;
}
function moveViewer(step) {
  if (!viewerPhotos.length) return;
  viewerIndex = (viewerIndex + step + viewerPhotos.length) % viewerPhotos.length;
  updateViewer();
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
  if (!photos.length) { status.textContent = 'No photos have been added yet. The album is ready for the troop’s first upload.'; return; }
  status.hidden = true; button.hidden = false; folderSelect.hidden = false;
  shuffle(); render();
}
grid.addEventListener('click', event => {
  const trigger = event.target.closest('[data-photo-index]');
  if (trigger) showViewer(Number(trigger.dataset.photoIndex));
});
folderSelect.addEventListener('change', () => { activeFolder = folderSelect.value; render(); });
button.addEventListener('click', () => { if (photos.length > 1) { shuffle(); render(); } });
document.querySelector('#viewer-close').addEventListener('click', () => viewer.close());
document.querySelector('#viewer-prev').addEventListener('click', () => moveViewer(-1));
document.querySelector('#viewer-next').addEventListener('click', () => moveViewer(1));
document.querySelector('#viewer-fullscreen').addEventListener('click', async event => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await viewer.requestFullscreen();
    event.currentTarget.setAttribute('aria-label', document.fullscreenElement ? 'Exit full screen' : 'Enter full screen');
  } catch { status.textContent = 'Your browser could not enter full screen; the photo viewer is still open.'; }
});
viewer.addEventListener('click', event => { if (event.target === viewer) viewer.close(); });
window.addEventListener('keydown', event => {
  if (!viewer.open) return;
  if (event.key === 'ArrowLeft') moveViewer(-1);
  if (event.key === 'ArrowRight') moveViewer(1);
});
viewer.addEventListener('close', () => {
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  document.querySelector('#viewer-fullscreen').setAttribute('aria-label', 'Enter full screen');
});
button.hidden = true; folderSelect.hidden = true; load();
