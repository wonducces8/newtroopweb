const navItems = [['Home','index.html'],['Our Troop','about.html'],['Adventure','adventures.html'],['Calendar','calendar.html'],['Photos','photos.html'],['People','people.html']];
const currentFile = location.pathname.split('/').pop() || 'index.html';
const header = document.querySelector('[data-site-header]');
const footer = document.querySelector('[data-site-footer]');
let siteSupabase = null;
if (header) {
  const inner = document.createElement('div'); inner.className = 'wrap header-inner';
  inner.innerHTML = '<a class="brand" href="index.html" aria-label="Troop 1941 home"><span class="brand-mark">1941</span><span><b>Troop 1941</b><small>Leesburg, Virginia</small></span></a><button class="menu-toggle" aria-expanded="false" aria-controls="site-nav" aria-label="Open menu"><span></span><span></span></button><nav id="site-nav" class="nav" aria-label="Main navigation"></nav>';
  header.append(inner);
  const nav = header.querySelector('.nav');
  navItems.forEach(([label, href]) => { const a = document.createElement('a'); a.href = href; a.textContent = label; if (href === currentFile) a.setAttribute('aria-current','page'); nav.append(a); });
  const visit = document.createElement('a'); visit.href = 'contact.html'; visit.className = 'nav-cta'; visit.textContent = 'Visit a meeting ↗'; nav.append(visit);
  const tools = document.createElement('div'); tools.className = 'site-admin-tools'; tools.hidden = true;
  tools.innerHTML = '<a href="admin.html">Admin tools <span aria-hidden="true">↗</span></a><button type="button" data-site-signout>Sign out</button>';
  nav.append(tools);
  const toggle = header.querySelector('.menu-toggle');
  toggle.addEventListener('click', () => { const open = toggle.getAttribute('aria-expanded') === 'true'; toggle.setAttribute('aria-expanded',String(!open)); toggle.setAttribute('aria-label',open?'Open menu':'Close menu'); nav.classList.toggle('open',!open); });
  nav.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => { toggle.setAttribute('aria-expanded','false'); nav.classList.remove('open'); }));
  tools.querySelector('[data-site-signout]').addEventListener('click', async () => { if (siteSupabase) await siteSupabase.auth.signOut(); });
  function showAdminTools(session) { tools.hidden = !session; }
  const config = window.TROOP_CONFIG || {};
  if (config.supabaseUrl && config.supabasePublishableKey) {
    window.TROOP_SUPABASE_PROMISE = window.TROOP_SUPABASE_PROMISE || import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm').then(({createClient}) => createClient(config.supabaseUrl, config.supabasePublishableKey));
    window.TROOP_SUPABASE_PROMISE.then(client => {
      siteSupabase = client;
      client.auth.getSession().then(result => showAdminTools(result.data.session)).catch(() => {});
      client.auth.onAuthStateChange((_event, session) => { setTimeout(() => showAdminTools(session), 0); });
    }).catch(() => {});
  }
}
if (footer) { footer.innerHTML = '<div class="wrap footer-top"><a class="brand" href="index.html"><span class="brand-mark">1941</span><span><b>Troop 1941</b><small>Leesburg, Virginia</small></span></a><p>Adventure, leadership, service.</p><div class="footer-links"><a href="calendar.html">Calendar</a><a href="contact.html">Visit us</a><a href="admin.html">Admin</a></div></div><div class="wrap footer-bottom"><span>© <span data-year></span> Troop 1941</span><span>Chartered by Isaak Walton League of America</span></div>'; }
document.querySelectorAll('[data-year]').forEach((node) => node.textContent = new Date().getFullYear());
