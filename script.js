const navItems = [['Home','index.html'],['Our Troop','about.html'],['Adventure','adventures.html'],['Calendar','calendar.html'],['Photos','photos.html'],['People','people.html']];
const currentFile = location.pathname.split('/').pop() || 'index.html';
const header = document.querySelector('[data-site-header]');
const footer = document.querySelector('[data-site-footer]');
if (header) {
  const inner = document.createElement('div'); inner.className = 'wrap header-inner';
  inner.innerHTML = '<a class="brand" href="index.html" aria-label="Troop 1941 home"><span class="brand-mark">1941</span><span><b>Troop 1941</b><small>Leesburg, Virginia</small></span></a><button class="menu-toggle" aria-expanded="false" aria-controls="site-nav" aria-label="Open menu"><span></span><span></span></button><nav id="site-nav" class="nav" aria-label="Main navigation"></nav>';
  header.append(inner);
  const nav = header.querySelector('.nav');
  navItems.forEach(([label, href]) => { const a = document.createElement('a'); a.href = href; a.textContent = label; if (href === currentFile) a.setAttribute('aria-current','page'); nav.append(a); });
  const visit = document.createElement('a'); visit.href = 'contact.html'; visit.className = 'nav-cta'; visit.textContent = 'Visit a meeting ↗'; nav.append(visit);
  const toggle = header.querySelector('.menu-toggle');
  toggle.addEventListener('click', () => { const open = toggle.getAttribute('aria-expanded') === 'true'; toggle.setAttribute('aria-expanded',String(!open)); toggle.setAttribute('aria-label',open?'Open menu':'Close menu'); nav.classList.toggle('open',!open); });
  nav.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => { toggle.setAttribute('aria-expanded','false'); nav.classList.remove('open'); }));
}
if (footer) { footer.innerHTML = '<div class="wrap footer-top"><a class="brand" href="index.html"><span class="brand-mark">1941</span><span><b>Troop 1941</b><small>Leesburg, Virginia</small></span></a><p>Adventure, leadership, service.</p><div class="footer-links"><a href="calendar.html">Calendar</a><a href="contact.html">Visit us</a></div></div><div class="wrap footer-bottom"><span>© <span data-year></span> Troop 1941</span><span>Chartered by Isaak Walton League of America</span></div>'; }
document.querySelectorAll('[data-year]').forEach((node) => node.textContent = new Date().getFullYear());