import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
const cfg = window.TROOP_CONFIG || {};
const status = document.querySelector('#admin-status');
const loginForm = document.querySelector('#login-form');
const editor = document.querySelector('#editor');
const ready = cfg.supabaseUrl && cfg.supabasePublishableKey;
const supabase = ready ? createClient(cfg.supabaseUrl, cfg.supabasePublishableKey) : null;
function message(text, kind) { status.textContent = text; status.className = 'notice ' + (kind || ''); }
function escapeHtml(value) { return String(value || '').replace(/[&<>"']/g, function (c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
function rowHtml(kind, item) {
  item = item || {}; const patrol = kind === 'patrols';
  let html = '<div class="edit-row" data-kind="' + kind + '">';
  html += '<label>' + (patrol ? 'Patrol name' : 'Position') + '<input data-field="' + (patrol ? 'name' : 'role') + '" value="' + escapeHtml(item[patrol ? 'name' : 'role']) + '" required></label>';
  html += '<label>' + (patrol ? 'Patrol leader (optional)' : 'Scout name') + '<input data-field="' + (patrol ? 'leader' : 'name') + '" value="' + escapeHtml(item[patrol ? 'leader' : 'name']) + '" ' + (patrol ? '' : 'required') + '></label>';
  if (patrol) html += '<label>Description (optional)<textarea data-field="description">' + escapeHtml(item.description) + '</textarea></label>';
  return html + '<button type="button" class="remove-row" aria-label="Remove row">Remove</button></div>';
}
function readRows(kind) {
  return Array.from(document.querySelectorAll('[data-kind="' + kind + '"]')).map(function (row) {
    const values = {};
    row.querySelectorAll('[data-field]').forEach(function (field) { if (field.value.trim()) values[field.dataset.field] = field.value.trim(); });
    return values;
  }).filter(function (row) { return kind === 'patrols' ? row.name : row.role && row.name; });
}
async function loadEditors(user) {
  const result = await supabase.from('troop_content').select('key,value').in('key', ['patrols','leaders']);
  if (result.error) throw result.error;
  const values = {};
  (result.data || []).forEach(function (row) { values[row.key] = row.value; });
  document.querySelector('#patrol-editor').innerHTML = (values.patrols || []).map(function (row) { return rowHtml('patrols', row); }).join('');
  document.querySelector('#leader-editor').innerHTML = (values.leaders || []).map(function (row) { return rowHtml('leaders', row); }).join('');
  document.querySelector('#admin-email').textContent = user.user_metadata && (user.user_metadata.full_name || user.user_metadata.name) || user.email || 'Signed in';
  loginForm.hidden = true; editor.hidden = false;
}
async function refreshSession(session) {
  if (!session) { loginForm.hidden = false; editor.hidden = true; return; }
  try { await loadEditors(session.user); message('Signed in. Changes save to the shared troop database.', 'admin-status-good'); }
  catch (error) { message('Could not load the roster: ' + error.message, 'admin-status-error'); }
}
if (!supabase) message('Supabase setup is incomplete. Check config.js and SETUP.md.', 'admin-status-error');
else {
  supabase.auth.getSession().then(function (result) { return refreshSession(result.data.session); });
  supabase.auth.onAuthStateChange(function (_event, session) { refreshSession(session); });
}
loginForm.addEventListener('submit', async function (event) {
  event.preventDefault(); if (!supabase) return;
  const form = new FormData(loginForm); message('Signing in…');
  const result = await supabase.auth.signInWithPassword({ email: form.get('email'), password: form.get('password') });
  if (result.error) message('Sign in failed: ' + result.error.message, 'admin-status-error');
});
document.querySelector('#sign-out').addEventListener('click', async function () { if (supabase) await supabase.auth.signOut(); });
document.addEventListener('click', async function (event) {
  const add = event.target.closest('[data-add]'); const remove = event.target.closest('.remove-row'); const save = event.target.closest('[data-save]');
  if (add) document.querySelector(add.dataset.add === 'patrols' ? '#patrol-editor' : '#leader-editor').insertAdjacentHTML('beforeend', rowHtml(add.dataset.add));
  if (remove) remove.closest('.edit-row').remove();
  if (save && supabase) {
    const key = save.dataset.save; const value = readRows(key); save.disabled = true; message('Saving ' + key + '…');
    const result = await supabase.from('troop_content').upsert({ key: key, value: value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    save.disabled = false;
    if (result.error) message('Could not save: ' + result.error.message, 'admin-status-error');
    else message((key === 'patrols' ? 'Patrols' : 'Leadership') + ' saved. Public page will show the updated details.', 'admin-status-good');
  }
});
