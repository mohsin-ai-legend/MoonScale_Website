// Entry point. Everything in this file works without the animation libraries,
// so the booking buttons keep working if the CDN is blocked.

const root = document.documentElement;
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

// ---- Booking link -----------------------------------------------------------
// Paste your scheduling link here (Calendly, Cal.com, ...) and every booking
// button on the page uses it. While it is empty, the buttons scroll to the
// closing section instead.
const BOOKING_URL = '';

if (BOOKING_URL) {
  document.querySelectorAll('[data-booking-link]').forEach((link) => {
    link.href = BOOKING_URL;
  });
}

// ---- Booking clicks, for analytics --------------------------------------------
// Every click on a booking button fires an "ms:cta" event that says which button
// it was (nav, hero, steps or closing), so an analytics snippet can listen for it.
document.addEventListener('click', (event) => {
  const button = event.target.closest('[data-cta]');
  if (!button) return;
  document.dispatchEvent(new CustomEvent('ms:cta', { detail: { position: button.dataset.cta } }));
});

// ---- Launch checks ------------------------------------------------------------
// Reminders in the browser console until both are dealt with.
const placeholders = document.querySelectorAll('[data-placeholder]');
if (placeholders.length) {
  console.warn(
    `moonScale: ${placeholders.length} result figure(s) are still placeholders. ` +
      'Replace them with real numbers, or hide the Results section, before launch.'
  );
}
if (!BOOKING_URL) {
  console.warn('moonScale: BOOKING_URL is empty in src/main.js, so the booking buttons only scroll to the closing section.');
}

// ---- In-page links ----------------------------------------------------------
// Glide to the section, then hand keyboard focus and the address bar to it,
// as a plain anchor jump would.
document.addEventListener('click', (event) => {
  if (event.defaultPrevented || event.button !== 0) return;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const link = event.target.closest('a[href^="#"]');
  if (!link) return;
  const id = decodeURIComponent(link.hash.slice(1));
  const target = id ? document.getElementById(id) : null;
  if (!target) return;

  event.preventDefault();
  target.scrollIntoView({ behavior: reduce.matches ? 'auto' : 'smooth', block: 'start' });
  if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
  target.focus({ preventScroll: true });
  history.replaceState(null, '', '#' + id);
});

// ---- One solid booking button at a time --------------------------------------
// The nav button is a quiet outline while a booking button in the page is on
// screen, and fills with ink when none is, so the ask is never out of reach.
const nav = document.querySelector('[data-nav]');
const inflow = [...document.querySelectorAll('[data-inflow]')];

if (nav && inflow.length && 'IntersectionObserver' in window) {
  const onScreen = new Set();
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) onScreen.add(entry.target);
        else onScreen.delete(entry.target);
      }
      nav.classList.toggle('is-asking', onScreen.size === 0);
    },
    { threshold: 0.6, rootMargin: `-${nav.offsetHeight}px 0px 0px 0px` }
  );
  inflow.forEach((button) => observer.observe(button));
} else if (nav) {
  nav.classList.add('is-asking');
}

// ---- Motion ------------------------------------------------------------------
// Loaded only for visitors who have not asked for reduced motion. If it cannot
// load, the page settles into its finished, static state.
if (reduce.addEventListener) reduce.addEventListener('change', () => window.location.reload());

if (!reduce.matches && root.classList.contains('motion')) {
  import('./motion.js')
    .then((motion) => motion.start())
    .catch((error) => {
      console.warn('Animation code did not load; showing the static page.', error);
      root.classList.remove('motion');
    });
}
