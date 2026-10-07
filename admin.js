const cfg = window.TROOP_CONFIG || {};
const status = document.querySelector('#admin-status');
const loginForm = document.querySelector('#login-form');
const editor = document.querySelector('#editor');
const ready = Boolean(cfg.supabaseUrl && cfg.supabasePublishableKey);
const supabase = ready ? await (window.TROOP_SUPABASE_PROMISE || (window.TROOP_SUPABASE_PROMISE = import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm').then(({createClient}) => createClient(cfg.supabaseUrl, cfg.supabasePublishableKey)))) : null;
const bucket = 'troop-photos';
const MAX_PHOTO_SIZE = 10 * 1024 * 1024;
function message(text, kind) { status.textContent = text; status.className = 'notice ' + (kind || ''); }
function escapeHtml(value) { return String(value || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function rowHtml(kind, item = {}) {
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
  }).filter(row => kind === 'patrols' ? row.name : row.role && row.name);
}
async function loadEditors(user) {
  const access = await supabase.from('site_admins').select('user_id').eq('user_id', user.id).maybeSingle();
  if (access.error || !access.data) throw new Error('This account is not on the admin allowlist. Add it in Supabase, then sign in again.');
  const result = await supabase.from('troop_content').select('key,value').in('key', ['patrols','leaders','announcement']);
  if (result.error) throw result.error;
  const values = {};
  (result.data || []).forEach(row => { values[row.key] = row.value; });
  document.querySelector('#patrol-editor').innerHTML = (values.patrols || []).map(row => rowHtml('patrols', row)).join('');
  document.querySelector('#leader-editor').innerHTML = (values.leaders || []).map(row => rowHtml('leaders', row)).join('');
  document.querySelector('#announcement-text').value = values.announcement && values.announcement.text || '';
  document.querySelector('#announcement-active').checked = Boolean(values.announcement && values.announcement.active && values.announcement.text);
  document.querySelector('#admin-email').textContent = user.user_metadata && (user.user_metadata.full_name || user.user_metadata.name) || user.email || 'Signed in';
  loginForm.hidden = true; editor.hidden = false;
  await loadPhotos();
}
async function loadPhotos() {
  const target = document.querySelector('#photo-library');
  target.innerHTML = '<p class="notice">Loading photo library…</p>';
  const result = await supabase.storage.from(bucket).list('', {limit: 100, sortBy: {column: 'created_at', order: 'desc'}});
  if (result.error) { target.innerHTML = '<p class="notice">Could not load photos: ' + escapeHtml(result.error.message) + '</p>'; return; }
  const photos = (result.data || []).filter(file => file.name && !file.name.startsWith('.'));
  if (!photos.length) { target.innerHTML = '<p class="empty-library">No photos yet. Upload a few to start the troop gallery.</p>'; return; }
  target.innerHTML = photos.map(file => {
    const url = supabase.storage.from(bucket).getPublicUrl(file.name).data.publicUrl;
    return '<figure class="library-photo"><img src="' + escapeHtml(url) + '" alt="Troop photo"><figcaption><span>' + escapeHtml(file.name.slice(-28)) + '</span><button class="remove-row" type="button" data-photo-delete="' + escapeHtml(file.name) + '">Delete</button></figcaption></figure>';
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
document.addEventListener('click', async event => {
  const add = event.target.closest('[data-add]');
  const remove = event.target.closest('.remove-row');
  const save = event.target.closest('[data-save]');
  const deletePhoto = event.target.closest('[data-photo-delete]');
  if (add) document.querySelector(add.dataset.add === 'patrols' ? '#patrol-editor' : '#leader-editor').insertAdjacentHTML('beforeend', rowHtml(add.dataset.add));
  if (remove) remove.closest('.edit-row').remove();
  if (save && supabase) {
    if (save.dataset.save === 'announcement') {
      const text = document.querySelector('#announcement-text').value.trim();
      await saveContent('announcement', {text, active: document.querySelector('#announcement-active').checked && Boolean(text)}, 'Announcement');
    } else await saveContent(save.dataset.save, readRows(save.dataset.save), save.dataset.save === 'patrols' ? 'Patrols' : 'Leadership');
  }
  if (deletePhoto && supabase) {
    const name = deletePhoto.dataset.photoDelete;
    if (!window.confirm('Delete this photo from the public gallery?')) return;
    deletePhoto.disabled = true;
    const result = await supabase.storage.from(bucket).remove([name]);
    if (result.error) message('Could not delete photo: ' + result.error.message, 'admin-status-error');
    else { message('Photo deleted.', 'admin-status-good'); await loadPhotos(); }
  }
});
document.querySelector('#photo-upload').addEventListener('change', async event => {
  if (!supabase) return;
  const input = event.currentTarget; const files = Array.from(input.files || []);
  if (!files.length) return;
  for (const file of files) {
    if (!['image/jpeg','image/png','image/webp'].includes(file.type)) { message(file.name + ' is not a JPG, PNG, or WebP image.', 'admin-status-error'); input.value = ''; return; }
    if (file.size > MAX_PHOTO_SIZE) { message(file.name + ' is larger than 10 MB.', 'admin-status-error'); input.value = ''; return; }
  }
  input.disabled = true; message('Uploading ' + files.length + (files.length === 1 ? ' photo…' : ' photos…'));
  for (const file of files) {
    const ext = file.name.split('.').pop().toLowerCase();
    const name = Date.now() + '-' + crypto.randomUUID() + '.' + ext;
    const result = await supabase.storage.from(bucket).upload(name, file, {cacheControl: '3600', upsert: false, contentType: file.type});
    if (result.error) { message('Upload failed: ' + result.error.message, 'admin-status-error'); input.disabled = false; input.value = ''; return; }
  }
  input.disabled = false; input.value = '';
  message('Photos uploaded and added to the public gallery.', 'admin-status-good');
  await loadPhotos();
});
