const cfg = window.TROOP_CONFIG || {};
const status = document.querySelector('#admin-status');
const loginForm = document.querySelector('#login-form');
const editor = document.querySelector('#editor');
const ready = Boolean(cfg.supabaseUrl && cfg.supabasePublishableKey);
const supabase = ready ? await (window.TROOP_SUPABASE_PROMISE || (window.TROOP_SUPABASE_PROMISE = import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm').then(({createClient}) => createClient(cfg.supabaseUrl, cfg.supabasePublishableKey)))).catch(() => null) : null;
const bucket = 'troop-photos';
const MAX_ORIGINAL_SIZE = 25 * 1024 * 1024;
const MAX_IMAGE_EDGE = 2048;
let folders = [];
function message(text, kind) { status.textContent = text; status.className = 'notice ' + (kind || ''); }
function escapeHtml(value) { return String(value || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function rowHtml(kind, item = {}) {
  if (kind === 'socials') return '<div class="edit-row social-edit-row" data-kind="socials"><label>Platform or label<input data-field="label" value="' + escapeHtml(item.label) + '" placeholder="Instagram" required></label><label>Profile URL<input data-field="url" type="url" value="' + escapeHtml(item.url) + '" placeholder="https://…" required></label><button type="button" class="remove-row" aria-label="Remove link">Remove</button></div>';
  const patrol = kind === 'patrols';
  let html = '<div class="edit-row" data-kind="' + kind + '">';
  html += '<label>' + (patrol ? 'Patrol name' : 'Position') + '<input data-field="' + (patrol ? 'name' : 'role') + '" value="' + escapeHtml(item[patrol ? 'name' : 'role']) + '" required></label>';
  html += '<label>' + (patrol ? 'Patrol leader (optional)' : 'Scout name') + '<input data-field="' + (patrol ? 'leader' : 'name') + '" value="' + escapeHtml(item[patrol ? 'leader' : 'name']) + '" ' + (patrol ? '' : 'required') + '></label>';
  if (patrol) html += '<label>Description (optional)<textarea data-field="description">' + escapeHtml(item.description) + '</textarea></label>';
  return html + '<button type="button" class="remove-row" aria-label="Remove row">Remove</button></div>';
}
function readRows(kind) {
  return Array.from(document.querySelectorAll('[data-kind="' + kind + '"]')).map(row => {
    const values = {};
    row.querySelectorAll('[data-field]').forEach(field => { if (field.value.trim()) values[field.dataset.field] = field.value.trim(); });
    return values;
  }).filter(row => kind === 'patrols' ? row.name : kind === 'leaders' ? row.role && row.name : row.label && row.url);
}
async function loadFolders(selectedName) {
  const result = await supabase.from('photo_folders').select('name').order('name');
  if (result.error) throw result.error;
  folders = result.data || [];
  const upload = document.querySelector('#photo-upload-folder');
  const filter = document.querySelector('#library-folder');
  const currentUpload = selectedName || upload.value || 'General';
  upload.innerHTML = folders.map(folder => '<option value="' + escapeHtml(folder.name) + '">' + escapeHtml(folder.name) + '</option>').join('');
  filter.innerHTML = '<option value="">All albums</option>' + folders.map(folder => '<option value="' + escapeHtml(folder.name) + '">' + escapeHtml(folder.name) + '</option>').join('');
  upload.value = folders.some(folder => folder.name === currentUpload) ? currentUpload : (folders[0] && folders[0].name || '');
}
async function loadEditors(user) {
  const access = await supabase.from('site_admins').select('user_id').eq('user_id', user.id).maybeSingle();
  if (access.error || !access.data) throw new Error('This account is not on the admin allowlist. Add it in Supabase, then sign in again.');
  const result = await supabase.from('troop_content').select('key,value').in('key', ['patrols','leaders','announcement','socials']);
  if (result.error) throw result.error;
  const values = {};
  (result.data || []).forEach(row => { values[row.key] = row.value; });
  document.querySelector('#patrol-editor').innerHTML = (values.patrols || []).map(row => rowHtml('patrols', row)).join('');
  document.querySelector('#leader-editor').innerHTML = (values.leaders || []).map(row => rowHtml('leaders', row)).join('');
  document.querySelector('#social-editor').innerHTML = (values.socials || []).map(row => rowHtml('socials', row)).join('');
  document.querySelector('#announcement-text').value = values.announcement && values.announcement.text || '';
  document.querySelector('#announcement-active').checked = Boolean(values.announcement && values.announcement.active && values.announcement.text);
  document.querySelector('#admin-email').textContent = user.user_metadata && (user.user_metadata.full_name || user.user_metadata.name) || user.email || 'Signed in';
  await loadFolders();
  loginForm.hidden = true; editor.hidden = false;
  await loadPhotos();
}
async function loadPhotos() {
  const target = document.querySelector('#photo-library');
  const selectedFolder = document.querySelector('#library-folder').value;
  target.innerHTML = '<p class="notice">Loading photo library…</p>';
  const result = await supabase.from('photo_library').select('path,folder_name,caption,created_at').order('created_at', {ascending:false}).limit(250);
  if (result.error) { target.innerHTML = '<p class="notice">Could not load photos: ' + escapeHtml(result.error.message) + '</p>'; return; }
  const photos = (result.data || []).filter(photo => !selectedFolder || photo.folder_name === selectedFolder);
  if (!photos.length) { target.innerHTML = '<p class="empty-library">No photos in this album yet.</p>'; return; }
  target.innerHTML = photos.map(photo => {
    const url = supabase.storage.from(bucket).getPublicUrl(photo.path).data.publicUrl;
    return '<article class="library-photo"><img src="' + escapeHtml(url) + '" alt="' + escapeHtml(photo.caption || 'Troop photo') + '"><div class="library-photo-edit"><small>' + escapeHtml(photo.folder_name) + '</small><label>Caption<input data-caption-for="' + escapeHtml(photo.path) + '" maxlength="180" value="' + escapeHtml(photo.caption) + '" placeholder="Optional caption"></label><div class="photo-actions"><button class="button button-green" type="button" data-save-caption="' + escapeHtml(photo.path) + '">Save caption</button><button class="remove-row" type="button" data-photo-delete="' + escapeHtml(photo.path) + '">Delete</button></div></div></article>';
  }).join('');
}
async function refreshSession(session) {
  if (!session) { loginForm.hidden = false; editor.hidden = true; return; }
  try { await loadEditors(session.user); message('Signed in. Your edits and photo uploads save to the shared troop site.', 'admin-status-good'); }
  catch (error) { message('Could not load admin data: ' + error.message, 'admin-status-error'); }
}
async function saveContent(key, value, label) {
  const button = document.querySelector('[data-save="' + key + '"]');
  if (button) button.disabled = true;
  message('Saving ' + label + '…');
  const result = await supabase.from('troop_content').upsert({key, value, updated_at: new Date().toISOString()}, {onConflict: 'key'});
  if (button) button.disabled = false;
  if (result.error) message('Could not save: ' + result.error.message, 'admin-status-error');
  else message(label + ' saved.', 'admin-status-good');
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
if (!supabase) message('Supabase setup is incomplete. Check config.js and SETUP.md.', 'admin-status-error');
else {
  supabase.auth.getSession().then(result => refreshSession(result.data.session)).catch(error => message('Could not connect to Supabase: ' + error.message, 'admin-status-error'));
  supabase.auth.onAuthStateChange((_event, session) => { setTimeout(() => refreshSession(session), 0); });
}
loginForm.addEventListener('submit', async event => {
  event.preventDefault(); if (!supabase) return;
  const form = new FormData(loginForm); const button = loginForm.querySelector('button[type=submit]');
  button.disabled = true; message('Signing in…');
  const result = await supabase.auth.signInWithPassword({email: form.get('email'), password: form.get('password')});
  button.disabled = false;
  if (result.error) message('Sign in failed: ' + result.error.message, 'admin-status-error');
});
document.querySelector('#sign-out').addEventListener('click', async () => { if (supabase) await supabase.auth.signOut(); });
document.querySelector('#library-folder').addEventListener('change', loadPhotos);
document.querySelector('#create-folder').addEventListener('click', async () => {
  const input = document.querySelector('#new-folder-name');
  const name = input.value.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9 _-]{0,39}$/.test(name)) { message('Use 1–40 letters, numbers, spaces, dashes, or underscores for an album name.', 'admin-status-error'); return; }
  const button = document.querySelector('#create-folder'); button.disabled = true;
  const result = await supabase.from('photo_folders').insert({name});
  button.disabled = false;
  if (result.error) { message(result.error.code === '23505' ? 'That album already exists.' : 'Could not create album: ' + result.error.message, 'admin-status-error'); return; }
  input.value = ''; await loadFolders(name); await loadPhotos(); message('Album created.', 'admin-status-good');
});
document.addEventListener('click', async event => {
  const add = event.target.closest('[data-add]');
  const remove = event.target.closest('.remove-row');
  const save = event.target.closest('[data-save]');
  const deletePhoto = event.target.closest('[data-photo-delete]');
  const saveCaption = event.target.closest('[data-save-caption]');
  if (add) { const target = add.dataset.add === 'patrols' ? '#patrol-editor' : add.dataset.add === 'socials' ? '#social-editor' : '#leader-editor'; document.querySelector(target).insertAdjacentHTML('beforeend', rowHtml(add.dataset.add)); }
  if (remove) remove.closest('.edit-row').remove();
  if (save && supabase) {
    if (save.dataset.save === 'announcement') {
      const text = document.querySelector('#announcement-text').value.trim();
      await saveContent('announcement', {text, active: document.querySelector('#announcement-active').checked && Boolean(text)}, 'Announcement');
    } else {
      const key = save.dataset.save; const value = readRows(key);
      if (key === 'socials') {
        for (const item of value) { try { const url = new URL(item.url); if (url.protocol !== 'https:') throw new Error(); item.url = url.href; } catch { message('Each social link must use a valid https:// URL.', 'admin-status-error'); return; } }
      }
      await saveContent(key, value, key === 'patrols' ? 'Patrols' : key === 'leaders' ? 'Leadership' : 'Social links');
    }
  }
  if (saveCaption && supabase) {
    const path = saveCaption.dataset.saveCaption;
    const input = document.querySelector('[data-caption-for="' + CSS.escape(path) + '"]');
    saveCaption.disabled = true;
    const result = await supabase.from('photo_library').update({caption:input.value.trim()}).eq('path', path);
    saveCaption.disabled = false;
    if (result.error) message('Could not save caption: ' + result.error.message, 'admin-status-error');
    else message('Caption saved.', 'admin-status-good');
  }
  if (deletePhoto && supabase) {
    const path = deletePhoto.dataset.photoDelete;
    if (!window.confirm('Delete this photo from the public gallery?')) return;
    deletePhoto.disabled = true;
    const storageResult = await supabase.storage.from(bucket).remove([path]);
    if (storageResult.error) { deletePhoto.disabled = false; message('Could not delete photo: ' + storageResult.error.message, 'admin-status-error'); return; }
    const rowResult = await supabase.from('photo_library').delete().eq('path', path);
    if (rowResult.error) { message('Photo file removed, but its library record could not be removed: ' + rowResult.error.message, 'admin-status-error'); return; }
    message('Photo deleted.', 'admin-status-good'); await loadPhotos();
  }
});
document.querySelector('#photo-upload').addEventListener('change', async event => {
  if (!supabase) return;
  const input = event.currentTarget; const files = Array.from(input.files || []);
  if (!files.length) return;
  for (const file of files) {
    if (!['image/jpeg','image/png','image/webp'].includes(file.type)) { message(file.name + ' is not a JPG, PNG, or WebP image.', 'admin-status-error'); input.value = ''; return; }
    if (file.size > MAX_ORIGINAL_SIZE) { message(file.name + ' is larger than 25 MB.', 'admin-status-error'); input.value = ''; return; }
  }
  input.disabled = true;
  const folder = document.querySelector('#photo-upload-folder').value;
  const caption = document.querySelector('#photo-upload-caption').value.trim();
  let uploaded = 0;
  for (let index = 0; index < files.length; index++) {
    message('Optimizing and uploading ' + (index + 1) + ' of ' + files.length + '…');
    try {
      const optimized = await optimizeImage(files[index]);
      const path = folder + '/' + crypto.randomUUID() + '.webp';
      const upload = await supabase.storage.from(bucket).upload(path, optimized, {cacheControl:'3600',upsert:false,contentType:'image/webp'});
      if (upload.error) throw upload.error;
      const row = await supabase.from('photo_library').insert({path,folder_name:folder,caption});
      if (row.error) { await supabase.storage.from(bucket).remove([path]); throw row.error; }
      uploaded++;
    } catch (error) { message('Upload stopped after ' + uploaded + ' photo(s): ' + error.message, 'admin-status-error'); break; }
  }
  input.disabled = false; input.value = '';
  await loadPhotos();
  if (uploaded === files.length) message(uploaded + (uploaded === 1 ? ' photo uploaded.' : ' photos uploaded.'), 'admin-status-good');
});
