const cfg = window.TROOP_CONFIG || {};
const grid = document.querySelector('#photo-gallery');
const status = document.querySelector('#gallery-status');
const button = document.querySelector('#shuffle-photos');
const folderSelect = document.querySelector('#gallery-folder');
const viewer = document.querySelector('#photo-viewer');
const viewerImage = document.querySelector('#viewer-image');
const viewerCaption = document.querySelector('#viewer-caption');
const memberTools = document.querySelector('#member-photo-tools');
const memberStatus = document.querySelector('#member-photo-status');
const uploadForm = document.querySelector('#member-upload-form');
const client = cfg.supabaseUrl && cfg.supabasePublishableKey
  ? await (window.TROOP_SUPABASE_PROMISE || (window.TROOP_SUPABASE_PROMISE = import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm').then(({createClient}) => createClient(cfg.supabaseUrl, cfg.supabasePublishableKey)))).catch(() => null)
  : null;
const bucket = 'troop-photos';
const MAX_ORIGINAL_SIZE = 25 * 1024 * 1024;
const MAX_IMAGE_EDGE = 2048;
let photos = [];
let folders = [];
let activeFolder = '';
let viewerPhotos = [];
let viewerIndex = 0;
let isShuffled = false;
let currentRole = null;
let isAdmin = false;
function escapeHtml(value) { return String(value || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function setMemberStatus(text, kind = '') {
  if (!memberStatus) return;
  memberStatus.textContent = text;
  memberStatus.className = 'notice ' + kind;
}
function setGalleryStatus(text) {
  status.hidden = false;
  status.textContent = text;
}
function newestFirst(items) {
  return [...items].sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
}
function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]]; }
  return copy;
}
function visiblePhotos() { return photos.filter(photo => !activeFolder || photo.folder_name === activeFolder); }
function updateCuratorFolderOptions() {
  const empty = folders.filter(folder => !photos.some(photo => photo.folder_name === folder.name));
  const select = document.querySelector('#curator-delete-album');
  if (select) select.innerHTML = empty.map(folder => '<option value="' + escapeHtml(folder.name) + '">' + escapeHtml(folder.name) + '</option>').join('') || '<option value="">No empty albums</option>';
}
function render() {
  const visible = visiblePhotos();
  const groups = new Map();
  visible.forEach(photo => { if (!groups.has(photo.folder_name)) groups.set(photo.folder_name, []); groups.get(photo.folder_name).push(photo); });
  const canCurate = isAdmin || currentRole === 'curator';
  const folderOptions = folders.map(folder => '<option value="' + escapeHtml(folder.name) + '">' + escapeHtml(folder.name) + '</option>').join('');
  grid.innerHTML = Array.from(groups, ([folder, items]) => '<section class="photo-album"><div class="album-heading"><span>ALBUM</span><h2>' + escapeHtml(folder) + '</h2><small>' + items.length + (items.length === 1 ? ' photo' : ' photos') + '</small></div><div class="photo-grid">' + items.map(photo => {
    const index = visible.indexOf(photo);
    const controls = canCurate ? '<div class="curator-photo-controls"><label>Caption<input data-caption-for="' + escapeHtml(photo.path) + '" maxlength="180" value="' + escapeHtml(photo.caption) + '" placeholder="Optional caption"></label><div><button class="button button-green" type="button" data-save-caption="' + escapeHtml(photo.path) + '">Save</button><label>Move to<select data-move-to="' + escapeHtml(photo.path) + '">' + folderOptions + '</select></label><button class="button button-dark" type="button" data-move-photo="' + escapeHtml(photo.path) + '">Move</button><button class="remove-row" type="button" data-delete-photo="' + escapeHtml(photo.path) + '">Delete</button></div></div>' : '';
    return '<figure class="photo-tile"><button class="photo-open" type="button" data-photo-index="' + index + '" aria-label="View full photo"><img src="' + escapeHtml(photo.url) + '" alt="' + escapeHtml(photo.caption || 'Troop 1941 activity photo') + '" loading="lazy"><span class="photo-expand" aria-hidden="true">⛶</span></button>' + (photo.caption ? '<figcaption>' + escapeHtml(photo.caption) + '</figcaption>' : '') + controls + '</figure>';
  }).join('') + '</div></section>').join('');
  updateCuratorFolderOptions();
}
async function loadMemberAccess() {
  if (!client) return;
  const sessionResult = await client.auth.getSession();
  const session = sessionResult.data && sessionResult.data.session;
  if (!session) return;
  memberTools.hidden = false;
  const adminResult = await client.from('site_admins').select('user_id').eq('user_id', session.user.id).maybeSingle();
  isAdmin = !adminResult.error && Boolean(adminResult.data);
  const accessResult = await client.from('photo_access_requests').select('status,role').eq('user_id', session.user.id).maybeSingle();
  currentRole = !accessResult.error && accessResult.data && accessResult.data.status === 'approved' ? accessResult.data.role : null;
  if (isAdmin || currentRole === 'contributor' || currentRole === 'curator') {
    uploadForm.hidden = false;
    setMemberStatus(isAdmin ? 'Signed in as a site administrator. Uploads publish immediately.' : currentRole === 'curator' ? 'Curator access is active. Uploads and archive controls are available.' : 'Contributor access is active. Uploads publish immediately to the selected album.', 'account-status-good');
    document.querySelector('#curator-tools').hidden = !(isAdmin || currentRole === 'curator');
  } else if (accessResult.data && accessResult.data.status === 'pending') {
    setMemberStatus('Your account is waiting for administrator approval. You’ll be able to upload after access is granted. Check status on your account page.', 'account-status-pending');
  } else if (accessResult.data && accessResult.data.status === 'rejected') {
    setMemberStatus('This account does not currently have photo permissions. Contact a site administrator.', 'account-status-error');
  } else {
    setMemberStatus('Your account does not have photo permissions yet. Visit your account page or contact an administrator.', 'account-status-error');
  }
}
async function loadFolders() {
  const result = await client.from('photo_folders').select('name').order('name');
  if (result.error) throw result.error;
  folders = result.data || [];
  folderSelect.innerHTML = '<option value="">All albums</option>' + folders.map(folder => '<option value="' + escapeHtml(folder.name) + '">' + escapeHtml(folder.name) + '</option>').join('');
  document.querySelector('#member-upload-folder').innerHTML = folders.map(folder => '<option value="' + escapeHtml(folder.name) + '">' + escapeHtml(folder.name) + '</option>').join('');
}
async function loadPhotos() {
  const result = await client.from('photo_library').select('path,folder_name,caption,created_at').order('created_at', {ascending:false}).limit(500);
  if (result.error) throw result.error;
  photos = newestFirst((result.data || []).map(photo => ({...photo,url:client.storage.from(bucket).getPublicUrl(photo.path).data.publicUrl})));
  if (!photos.length) { grid.innerHTML = ''; setGalleryStatus('No photos have been added yet. The album is ready for the troop’s first upload.'); return; }
  status.hidden = true;
  folderSelect.hidden = false;
  button.hidden = false;
  render();
}
async function load() {
  if (!client) { setGalleryStatus('The photo library is not connected yet.'); return; }
  try {
    await loadMemberAccess();
    await loadFolders();
    await loadPhotos();
  } catch (error) {
    setGalleryStatus('Photo library is still being set up. Please try again later.');
    if (!memberTools.hidden) setMemberStatus('Could not load photo tools: ' + error.message, 'account-status-error');
  }
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
async function optimizeImage(file) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext('2d');
  if (!context) { bitmap.close(); throw new Error('This browser could not prepare the image.'); }
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', 0.84));
  if (!blob) throw new Error('This browser could not optimize the image.');
  return new File([blob], 'troop-photo.webp', {type:'image/webp',lastModified:Date.now()});
}
grid.addEventListener('click', async event => {
  const trigger = event.target.closest('[data-photo-index]');
  if (trigger) { showViewer(Number(trigger.dataset.photoIndex)); return; }
  const save = event.target.closest('[data-save-caption]');
  if (save) {
    const path = save.dataset.saveCaption;
    const input = grid.querySelector('[data-caption-for="' + CSS.escape(path) + '"]');
    save.disabled = true;
    const result = await client.from('photo_library').update({caption:input.value.trim()}).eq('path', path);
    save.disabled = false;
    if (result.error) { setMemberStatus('Could not save caption: ' + result.error.message, 'account-status-error'); return; }
    setMemberStatus('Caption saved.', 'account-status-good'); await loadPhotos(); return;
  }
  const move = event.target.closest('[data-move-photo]');
  if (move) {
    const oldPath = move.dataset.movePhoto;
    const photo = photos.find(item => item.path === oldPath);
    const destination = grid.querySelector('[data-move-to="' + CSS.escape(oldPath) + '"]').value;
    if (!photo || !destination || destination === photo.folder_name) return;
    move.disabled = true;
    const extension = (photo.path.split('.').pop() || 'webp').replace(/[^a-z0-9]/gi,'');
    const newPath = destination + '/' + crypto.randomUUID() + '.' + extension;
    const storageResult = await client.storage.from(bucket).move(oldPath, newPath);
    if (storageResult.error) { move.disabled = false; setMemberStatus('Could not move photo: ' + storageResult.error.message, 'account-status-error'); return; }
    const rowResult = await client.from('photo_library').update({path:newPath,folder_name:destination}).eq('path', oldPath);
    if (rowResult.error) {
      await client.storage.from(bucket).move(newPath, oldPath);
      move.disabled = false; setMemberStatus('Could not update the album record: ' + rowResult.error.message, 'account-status-error'); return;
    }
    setMemberStatus('Photo moved.', 'account-status-good'); await loadFolders(); await loadPhotos(); return;
  }
  const remove = event.target.closest('[data-delete-photo]');
  if (remove) {
    const path = remove.dataset.deletePhoto;
    if (!window.confirm('Remove this photo from the public troop archive?')) return;
    remove.disabled = true;
    const storageResult = await client.storage.from(bucket).remove([path]);
    if (storageResult.error) { remove.disabled = false; setMemberStatus('Could not remove photo: ' + storageResult.error.message, 'account-status-error'); return; }
    const rowResult = await client.from('photo_library').delete().eq('path', path);
    if (rowResult.error) { setMemberStatus('Photo file removed, but its album record could not be removed: ' + rowResult.error.message, 'account-status-error'); return; }
    setMemberStatus('Photo removed.', 'account-status-good'); await loadPhotos();
  }
});
folderSelect.addEventListener('change', () => { activeFolder = folderSelect.value; render(); });
button.addEventListener('click', () => {
  if (!photos.length) return;
  if (isShuffled) { photos = newestFirst(photos); button.textContent = '↻ Shuffle'; isShuffled = false; }
  else { photos = shuffle(photos); button.textContent = '↻ Newest first'; isShuffled = true; }
  render();
});
document.querySelector('#member-upload-form').addEventListener('submit', async event => {
  event.preventDefault();
  const input = document.querySelector('#member-photo-files');
  const files = Array.from(input.files || []);
  if (!files.length) return;
  for (const file of files) {
    if (!['image/jpeg','image/png','image/webp'].includes(file.type)) { setMemberStatus(file.name + ' is not a JPG, PNG, or WebP image.', 'account-status-error'); return; }
    if (file.size > MAX_ORIGINAL_SIZE) { setMemberStatus(file.name + ' is larger than 25 MB.', 'account-status-error'); return; }
  }
  const submit = event.currentTarget.querySelector('button[type=submit]');
  submit.disabled = true;
  const folder = document.querySelector('#member-upload-folder').value;
  const caption = document.querySelector('#member-upload-caption').value.trim();
  let uploaded = 0;
  for (let index = 0; index < files.length; index++) {
    setMemberStatus('Optimizing and uploading ' + (index + 1) + ' of ' + files.length + '…');
    let path = '';
    try {
      const optimized = await optimizeImage(files[index]);
      path = folder + '/' + crypto.randomUUID() + '.webp';
      const storageResult = await client.storage.from(bucket).upload(path, optimized, {cacheControl:'3600',upsert:false,contentType:'image/webp'});
      if (storageResult.error) throw storageResult.error;
      const row = await client.from('photo_library').insert({path,folder_name:folder,caption});
      if (row.error) {
        await client.storage.from(bucket).remove([path]);
        throw row.error;
      }
      uploaded++;
    } catch (error) {
      setMemberStatus('Upload stopped after ' + uploaded + ' photo(s): ' + error.message, 'account-status-error');
      break;
    }
  }
  input.value = '';
  submit.disabled = false;
  await loadPhotos();
  if (uploaded === files.length) setMemberStatus(uploaded + (uploaded === 1 ? ' photo uploaded. It is now in the public archive.' : ' photos uploaded. They are now in the public archive.'), 'account-status-good');
});
document.querySelector('#curator-create-album').addEventListener('click', async () => {
  const input = document.querySelector('#curator-new-album');
  const name = input.value.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9 _-]{0,39}$/.test(name)) { setMemberStatus('Use 1–40 letters, numbers, spaces, dashes, or underscores for an album name.', 'account-status-error'); return; }
  const button = document.querySelector('#curator-create-album');
  button.disabled = true;
  const result = await client.from('photo_folders').insert({name});
  button.disabled = false;
  if (result.error) { setMemberStatus(result.error.code === '23505' ? 'That album already exists.' : 'Could not create album: ' + result.error.message, 'account-status-error'); return; }
  input.value = ''; await loadFolders(); await loadPhotos(); setMemberStatus('Album created.', 'account-status-good');
});
document.querySelector('#curator-remove-album').addEventListener('click', async () => {
  const select = document.querySelector('#curator-delete-album');
  const name = select.value;
  if (!name) { setMemberStatus('There are no empty albums to remove.', 'account-status-pending'); return; }
  if (!window.confirm('Remove the empty album “' + name + '”?')) return;
  const result = await client.from('photo_folders').delete().eq('name',name);
  if (result.error) { setMemberStatus('Could not remove album: ' + result.error.message, 'account-status-error'); return; }
  await loadFolders(); await loadPhotos(); setMemberStatus('Empty album removed.', 'account-status-good');
});
document.querySelector('#viewer-close').addEventListener('click', () => viewer.close());
document.querySelector('#viewer-prev').addEventListener('click', () => moveViewer(-1));
document.querySelector('#viewer-next').addEventListener('click', () => moveViewer(1));
document.querySelector('#viewer-fullscreen').addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await viewer.requestFullscreen();
  } catch { setGalleryStatus('Your browser could not enter full screen; the photo is still available in the scrollable viewer.'); }
});
document.addEventListener('fullscreenchange', () => {
  document.querySelector('#viewer-fullscreen').setAttribute('aria-label', document.fullscreenElement ? 'Exit full screen' : 'Enter full screen');
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
button.hidden = true;
folderSelect.hidden = true;
load();
