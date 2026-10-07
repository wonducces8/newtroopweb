const cfg = window.TROOP_CONFIG || {};
const status = document.querySelector('#account-status');
const forms = document.querySelector('#account-forms');
const signedPanel = document.querySelector('#signed-in-panel');
const client = cfg.supabaseUrl && cfg.supabasePublishableKey
  ? await (window.TROOP_SUPABASE_PROMISE || (window.TROOP_SUPABASE_PROMISE = import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm').then(({createClient}) => createClient(cfg.supabaseUrl, cfg.supabasePublishableKey)))).catch(() => null)
  : null;

function setStatus(text, kind = '') {
  status.textContent = text;
  status.className = 'notice ' + kind;
  status.hidden = !text;
}
function setBusy(form, busy) {
  const button = form.querySelector('button[type=submit]');
  if (button) button.disabled = busy;
}
function safeMessage(error) {
  return error && error.message ? error.message : 'Please try again in a moment.';
}
async function showAccount(session) {
  if (!session || !client) {
    forms.hidden = false;
    signedPanel.hidden = true;
    setStatus('Sign in or request a member account below.');
    return;
  }
  forms.hidden = true;
  signedPanel.hidden = false;
  document.querySelector('#account-heading').textContent = 'You’re signed in.';
  document.querySelector('#account-summary').textContent = session.user.email || 'Your account';
  document.querySelector('#account-actions').replaceChildren();
  const admin = await client.from('site_admins').select('user_id').eq('user_id', session.user.id).maybeSingle();
  if (!admin.error && admin.data) {
    document.querySelector('#account-summary').textContent += ' · Site administrator';
    addAction('Open admin tools', 'admin.html');
    addAction('Open photo archive', 'photos.html');
    setStatus('You have full site administrator access.', 'account-status-good');
    return;
  }
  const access = await client.from('photo_access_requests').select('status,role').eq('user_id', session.user.id).maybeSingle();
  if (access.error || !access.data) {
    setStatus('We could not find your access request. The account system may still need its database setup. Contact a site administrator.', 'account-status-error');
    return;
  }
  if (access.data.status === 'pending') {
    setStatus('Your account is waiting for administrator approval. You can sign in here any time to check its status.', 'account-status-pending');
  } else if (access.data.status === 'rejected') {
    setStatus('This account does not currently have member permissions. Contact a site administrator if you think this is a mistake.', 'account-status-error');
  } else {
    const roleText = access.data.role === 'curator' ? 'Photo curator' : 'Photo contributor';
    document.querySelector('#account-summary').textContent += ' · ' + roleText;
    addAction('Open photo archive', 'photos.html');
    setStatus('Your account is approved. Your assigned photo permissions are active.', 'account-status-good');
  }
}
function addAction(label, href) {
  const link = document.createElement('a');
  link.className = 'button button-green';
  link.href = href;
  link.textContent = label + ' →';
  document.querySelector('#account-actions').append(link);
}
if (!client) {
  setStatus('The troop account system is not connected yet. Check the site setup and try again.', 'account-status-error');
} else {
  const result = await client.auth.getSession();
  if (result.error) setStatus('Could not connect to sign in: ' + safeMessage(result.error), 'account-status-error');
  else {
    await showAccount(result.data.session);
    if (!result.data.session) setStatus('Sign in or request a member account below.');
  }
  client.auth.onAuthStateChange((_event, session) => setTimeout(() => showAccount(session), 0));
}
document.querySelector('#sign-in-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (!client) return;
  const form = event.currentTarget;
  const values = new FormData(form);
  setBusy(form, true); setStatus('Signing in…');
  const result = await client.auth.signInWithPassword({email: values.get('email'), password: values.get('password')});
  setBusy(form, false);
  if (result.error) setStatus('Sign in failed: ' + safeMessage(result.error), 'account-status-error');
  else await showAccount(result.data.session);
});
document.querySelector('#sign-up-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (!client) return;
  const form = event.currentTarget;
  const values = new FormData(form);
  setBusy(form, true); setStatus('Sending your account request…');
  const result = await client.auth.signUp({
    email: values.get('email'),
    password: values.get('password'),
    options: {
      data: {full_name: values.get('full_name').trim()},
      emailRedirectTo: new URL('login.html', location.href).href
    }
  });
  setBusy(form, false);
  if (result.error) {
    setStatus('Could not request an account: ' + safeMessage(result.error), 'account-status-error');
  } else if (result.data.session) {
    await showAccount(result.data.session);
  } else {
    form.reset();
    setStatus('Request received. Check your email to confirm the address, then sign in here. Your account will remain pending until an administrator approves it.', 'account-status-good');
  }
});
document.querySelector('#account-signout').addEventListener('click', async () => {
  if (client) await client.auth.signOut();
});
