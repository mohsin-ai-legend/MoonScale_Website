// All scroll and load animation. Uses GSAP with ScrollTrigger.
//
// The motion kit is small on purpose, and all of it comes from the word "scale":
//   - the scale object in the hero grows (times ten, three times) and its figure gains a zero each time
//   - things scale up into place: headings, result figures, the closing panel
//   - hairlines are ruled in, and an index slides along a rule
// No text is ever hidden or dimmed while it waits for a scroll, and the headline,
// the copy and the booking buttons are never animated.

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { arrivalTable, cubesAt } from './scale-model.js';

gsap.registerPlugin(ScrollTrigger);

// Set to false to stop the hero holding still while the block stacks (desktop only).
// The block then stacks as the hero scrolls away, as it does on phones.
const PIN_HERO = true;

const root = document.documentElement;
const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

// Only elements that start below the screen are given a starting state,
// so nothing already visible ever jumps.
const below = (el) => el.getBoundingClientRect().top > window.innerHeight;

function whenVisible(el, amount, run) {
  const observer = new IntersectionObserver(
    ([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      run();
    },
    { threshold: amount }
  );
  observer.observe(el);
}

export function start() {
  // The failsafe in <head> may already have settled the page into its static state.
  if (!root.classList.contains('motion')) return;
  window.__msReady = true;

  ScrollTrigger.config({ ignoreMobileResize: true });

  // Created top to bottom, so each trigger is measured after the ones above it.
  hero();
  navBorder();
  headings();
  rules();
  results();
  painPoints();
  ai();
  steps();
  closing();
  faq();

  // Web fonts change line breaks and heights, so measure again once they are in.
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => ScrollTrigger.refresh());
}

/* ---------- Hero: the scale object, its rule and its figure ---------- */
function hero() {
  const heroEl = $('.hero');
  const nav = $('.nav');
  const stage = $('.stage');
  if (!heroEl || !nav || !stage) return;

  const canvas = $('.stage-canvas', stage);
  const index = $('.scale-index', stage);
  const rule = $('.scale-ticks', stage);
  const ticks = $$('i', rule).map((el) => ({ el, at: parseFloat(el.style.getPropertyValue('--p')) / 100 }));
  const labels = $$('.scale-labels li', stage);

  // The figure: "$10,000" plus three zeros and a comma that arrive one stage at a time.
  const reading = $('.reading', stage);
  const zeros = [1, 2, 3].map((k) => $(`[data-zero="${k}"]`, reading));
  const comma = $('[data-comma]', reading);
  const blocks = [0, 1, 2].map((k) => $(`[data-block="${k}"]`, reading));
  const refZero = $('[data-ref-zero]', reading);
  const refComma = $('[data-ref-comma]', reading);

  // Data-saver and very low-memory devices keep the drawing of the finished block.
  const lowEnd = (navigator.connection && navigator.connection.saveData) || navigator.deviceMemory <= 2;
  if (lowEnd) {
    stage.classList.add('is-fallback');
    return;
  }

  const table = arrivalTable();
  const setIndex = gsap.quickSetter(index, 'x', 'px');
  const setBlock = blocks.map((el) => gsap.quickSetter(el, 'x', 'px'));
  const setZero = zeros.map((el) => gsap.quickSetter(el, 'css'));
  const setComma = gsap.quickSetter(comma, 'css');
  const arrive = gsap.parseEase('power2.inOut');
  const span = (x, from, to) => gsap.utils.clamp(0, 1, (x - from) / (to - from));

  // grow = load + scroll. The intro takes it from one cube to a floor of a hundred;
  // scrolling stacks the floor into the block of a thousand.
  const S = { unit: 0, load: 0, scroll: 0 };
  let scale = null; // the 3D scene, once it has loaded
  let live = true; // false once the stage has fallen back to the drawing
  let ruleWidth = 0;
  let zeroWidth = 0;
  let commaWidth = 0;
  let lastPos = 0;

  function measure() {
    ruleWidth = rule.offsetWidth;
    zeroWidth = refZero.getBoundingClientRect().width;
    commaWidth = refComma.getBoundingClientRect().width;
  }

  function flick(from, to) {
    const lo = Math.min(from, to);
    const hi = Math.max(from, to);
    for (const tick of ticks) {
      if (tick.at > lo && tick.at <= hi) {
        gsap.fromTo(tick.el, { scaleY: 1.8 }, { scaleY: 1, duration: 0.3, ease: 'power2.out', overwrite: true });
      }
    }
  }

  // Each zero opens up during the second half of its stage, so the figure reads
  // $100,000 as the row completes, $1,000,000 with the floor and $10,000,000 with the block.
  // Only those four numbers ever show in full.
  function drawFigure(grow) {
    const e1 = arrive(span(grow, 0.45, 1));
    const e2 = arrive(span(grow, 1.45, 2));
    const e3 = arrive(span(grow, 2.45, 3));
    setBlock[0](-(1 - e1) * zeroWidth);
    setBlock[1](-(1 - e2) * (zeroWidth + commaWidth));
    setBlock[2](-(1 - e3) * zeroWidth);
    setZero[0]({ opacity: e1, scale: 0.5 + 0.5 * e1 });
    setZero[1]({ opacity: e2, scale: 0.5 + 0.5 * e2 });
    setZero[2]({ opacity: e3, scale: 0.5 + 0.5 * e3 });
    setComma({ opacity: e2, yPercent: -35 * (1 - e2) });
  }

  // One place turns the grow value into everything on screen: the block,
  // the index on the rule and the figure all follow the same number.
  function apply() {
    if (!live) return;
    const grow = S.load + S.scroll;
    const pos = Math.log10(cubesAt(table, grow)) / 3; // 0..1 along the rule

    setIndex(pos * ruleWidth);
    if (Math.abs(pos - lastPos) < 0.25) flick(lastPos, pos);
    labels.forEach((label, k) => label.classList.toggle('is-on', pos >= k / 3 - 0.002));
    lastPos = pos;

    drawFigure(grow);
    if (scale) scale.set(grow, S.unit);
  }

  const onRefresh = () => {
    measure();
    apply();
  };
  ScrollTrigger.addEventListener('refresh', onRefresh);

  const intro = gsap
    .timeline({ paused: true, onUpdate: apply })
    .to(S, { unit: 1, duration: 0.45, ease: 'back.out(1.6)' }, 0)
    .to(S, { load: 1, duration: 0.9, ease: 'power3.inOut' }, 0.4)
    .to(S, { load: 2, duration: 1.1, ease: 'power3.inOut' }, 1.4);

  // Desktop with a mouse or trackpad: the hero holds still for three quarters of a screen
  // while the block stacks. Phones, tablets and short windows: no pin, the block stacks as
  // the hero scrolls away. The pin is also skipped when the page did not start at the top,
  // so adding it can never make the content jump.
  const DESKTOP = '(min-width: 960px) and (min-height: 640px) and (hover: hover) and (pointer: fine)';
  const mm = gsap.matchMedia();
  mm.add(
    { desktop: DESKTOP, other: 'not all and ' + DESKTOP },
    (context) => {
      // What must fit is the content; the bottom padding may run past the fold.
      const padBottom = parseFloat(window.getComputedStyle(heroEl).paddingBottom) || 0;
      const fits = heroEl.offsetHeight - padBottom <= window.innerHeight - nav.offsetHeight + 1;
      const pin = PIN_HERO && context.conditions.desktop && fits && window.scrollY < 4;
      const twoColumns = window.innerWidth >= 960;

      gsap.to(S, {
        scroll: 1,
        ease: 'none',
        onUpdate: apply,
        scrollTrigger: pin
          ? {
              trigger: heroEl,
              start: () => 'top top+=' + nav.offsetHeight,
              end: () => '+=' + Math.round(window.innerHeight * 0.75),
              pin: true,
              scrub: 0.6,
              anticipatePin: 1,
              invalidateOnRefresh: true,
              refreshPriority: 1, // always measured before the sections below it
            }
          : {
              trigger: stage,
              start: 'clamp(top 62%)',
              // One column: finish as the stage reaches the nav, so block and figure end on screen together.
              end: () =>
                twoColumns
                  ? '+=' + Math.round(window.innerHeight * 0.42)
                  : 'top ' + (nav.offsetHeight + 12) + 'px',
              scrub: 0.6,
              invalidateOnRefresh: true,
              refreshPriority: 1,
            },
      });

      return () => {
        S.scroll = 0;
        apply();
      };
    }
  );

  let cue = null; // the idle "there is another dimension" hint
  let cueWait = null;

  function fallback() {
    if (!live) return;
    live = false; // from here on nothing may redraw the figure or the rule
    stage.classList.add('is-fallback');
    stage.classList.remove('is-live');
    ScrollTrigger.removeEventListener('refresh', onRefresh);
    intro.kill();
    if (cue) cue.kill();
    if (cueWait) cueWait.kill();
    // Removing the pin takes its scroll distance out of the page. Give it back, so
    // whatever the visitor is looking at stays where it is.
    const held = ScrollTrigger.getAll().find((t) => t.pin === heroEl);
    const y = window.scrollY;
    const start = held ? held.start : 0;
    const span = held ? held.end - held.start : 0;
    mm.revert(); // no pin and no scrub: the drawing already shows the finished block
    if (span && y > start) window.scrollTo(0, y - Math.min(span, y - start));
    gsap.set([index, ...blocks, ...zeros, comma], { clearProps: 'all' });
    labels.forEach((label) => label.classList.remove('is-on'));
    if (scale) {
      scale.dispose();
      scale = null;
    }
    ScrollTrigger.refresh();
  }

  measure();
  apply();
  reading.classList.add('is-set');

  // If the 3D code has not arrived after a few seconds, stop waiting and show the drawing.
  const giveUp = gsap.delayedCall(6, () => {
    if (!scale) fallback();
  });
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  // three.js is fetched after first paint and only for visitors who get the 3D scene.
  import('./scale3d.js')
    .then(({ createScale }) => {
      if (stage.classList.contains('is-fallback')) return; // arrived too late; the drawing is already up
      giveUp.kill();
      // The slow camera sway is for mouse and trackpad devices; elsewhere the scene only redraws on change.
      scale = createScale(canvas, { onLost: fallback, sway: finePointer });
      apply();
      scale.renderOnce();
      stage.classList.add('is-live');
      scale.start();

      if (window.scrollY > window.innerHeight * 0.4) intro.progress(1);
      else whenVisible(stage, 0.3, () => live && intro.play());

      // While the visitor has not scrolled, the first cube of the next layer
      // peeks up now and then: a scroll hint made by the object itself.
      const hint = { v: 0 };
      const pushHint = () => scale && scale.peek(hint.v);
      cue = gsap
        .timeline({ paused: true, repeat: -1, repeatDelay: 5.4, onUpdate: pushHint })
        .to(hint, { v: 1, duration: 0.8, ease: 'sine.inOut' })
        .to(hint, { v: 0, duration: 0.8, ease: 'sine.inOut' });
      intro.eventCallback('onComplete', () => {
        if (live && window.scrollY <= 10) cueWait = gsap.delayedCall(2.5, () => live && cue.play());
      });
      const stopCue = () => {
        if (window.scrollY <= 10) return;
        window.removeEventListener('scroll', stopCue);
        if (cueWait) cueWait.kill();
        cue.kill();
        gsap.to(hint, { v: 0, duration: 0.3, onUpdate: pushHint });
      };
      window.addEventListener('scroll', stopCue, { passive: true });

      // A small lean toward the pointer on devices that have one.
      if (finePointer) {
        window.addEventListener(
          'pointermove',
          (event) => {
            if (!scale) return;
            scale.pointer((event.clientX / window.innerWidth) * 2 - 1, 1 - (event.clientY / window.innerHeight) * 2);
          },
          { passive: true }
        );
      }
    })
    .catch((error) => {
      console.warn('3D scale unavailable; showing the drawing instead.', error);
      giveUp.kill();
      fallback();
    });
}

/* ---------- Nav: a hairline under it once the page has moved ---------- */
function navBorder() {
  ScrollTrigger.create({ start: 8, end: 'max', toggleClass: { targets: '.nav', className: 'is-scrolled' } });
}

/* ---------- Section headings scale up into place ---------- */
// They are fully visible the whole time; they only grow as they rise.
function headings() {
  $$('[data-grow]')
    .filter(below)
    .forEach((heading) => {
      const centred = window.getComputedStyle(heading).textAlign === 'center';
      gsap.fromTo(
        heading,
        { scale: 0.84 },
        {
          scale: 1,
          ease: 'none',
          transformOrigin: centred ? '50% 100%' : '0% 100%',
          scrollTrigger: {
            // Measured on the unscaled wrapper, so the heading's own scale never shifts the trigger.
            trigger: heading.closest('.wrap') || heading,
            start: 'clamp(top 96%)',
            end: 'clamp(top 60%)', // clamp: reachable even at the very end of the page
            scrub: 0.4,
          },
        }
      );
    });
}

/* ---------- Hairlines are ruled in as they arrive ---------- */
function rules() {
  ScrollTrigger.batch('[data-rule]', {
    start: 'top 88%',
    once: true,
    onEnter: (batch) =>
      batch.forEach((el, i) => {
        el.style.setProperty('--i', i);
        el.classList.add('is-in');
      }),
  });
}

/* ---------- Pain points: three ink lines stall, then run on together ---------- */
function painPoints() {
  const group = $('.three');
  const pivot = $('.pivot');
  if (!group || !pivot) return;

  ScrollTrigger.batch($$('.stall', group), {
    start: 'top 80%',
    once: true,
    onEnter: (batch) =>
      batch.forEach((el, i) => {
        el.style.setProperty('--i', i);
        el.classList.add('is-stalled');
      }),
  });

  ScrollTrigger.create({
    trigger: pivot,
    start: 'top 80%',
    once: true,
    onEnter: () => group.classList.add('is-solved'),
  });
}

/* ---------- Case study: real numbers count up, and the bar scales 30 times ---------- */
// Only real figures carry data-count. The HTML holds the final value, so without
// motion the right number is always there.
function countUp(el, delay = 0) {
  const end = Number(el.dataset.count);
  if (!Number.isFinite(end)) return;
  const format = new Intl.NumberFormat('en-US');
  const prefix = el.dataset.prefix || '';
  const suffix = el.dataset.suffix || '';
  const write = (v) => {
    el.textContent = prefix + format.format(v) + suffix;
  };
  const value = { v: 0 };
  write(0);
  gsap.to(value, {
    v: end,
    delay,
    duration: 1.6,
    ease: 'power3.out',
    snap: { v: 1 },
    onUpdate: () => write(value.v),
  });
}

function results() {
  const section = $('.case');
  if (!section) return;

  // Stats count up once, when they come into view.
  const counters = $$('.stats [data-count]', section).filter(below);
  if (counters.length) {
    ScrollTrigger.create({
      trigger: $('.stats', section),
      start: 'top 85%',
      once: true,
      onEnter: () => counters.forEach((el, i) => countUp(el, i * 0.12)),
    });
  }

  // The "now" bar grows from the "before" length to thirty times it, with the scroll.
  const after = $('.bar-after', section);
  const bars = $('.bars', section);
  if (after && bars && below(bars)) {
    gsap.fromTo(
      after,
      { scaleX: 1 / 30 },
      {
        scaleX: 1,
        ease: 'power1.inOut',
        scrollTrigger: { trigger: bars, start: 'clamp(top 85%)', end: 'clamp(top 35%)', scrub: 0.6 },
      }
    );
  }
}

/* ---------- AI engine: the rail fills and each stage lights up; the format belt drifts ---------- */
function ai() {
  const section = $('.ai');
  const pipe = section && $('.pipe', section);
  if (!pipe) return;
  const stages = $$('li', pipe);

  ScrollTrigger.create({ trigger: section, start: 'top bottom', end: 'bottom top', toggleClass: 'is-live' });

  if (!below(pipe)) return;
  pipe.classList.add('is-live');
  gsap.fromTo(
    pipe,
    { '--fill': 0 },
    {
      '--fill': 1,
      ease: 'none',
      scrollTrigger: {
        trigger: pipe,
        start: 'clamp(top 78%)',
        end: 'clamp(bottom 60%)',
        scrub: 0.5,
        onUpdate: (self) => {
          stages.forEach((li, i) => {
            li.classList.toggle('is-on', self.progress >= i / Math.max(1, stages.length - 1) - 0.001);
          });
        },
      },
    }
  );
}

/* ---------- Steps: an index travels along the rule from 1 to 3 ---------- */
function steps() {
  const wrap = $('.steps-wrap');
  if (!wrap) return;
  const list = $('.steps', wrap);
  const items = $$('li', list);
  const fill = $('.steps-fill', wrap);
  const index = $('.steps-index', wrap);
  if (items.length < 3 || !fill || !index) return;

  const mm = gsap.matchMedia();
  mm.add({ row: '(min-width: 861px)', column: '(max-width: 860.98px)' }, (context) => {
    const row = context.conditions.row;
    const reach = () =>
      row ? items[2].offsetLeft - items[0].offsetLeft : items[2].offsetTop - items[0].offsetTop;
    const measure = () => wrap.style.setProperty('--reach', reach() + 'px');

    measure();
    list.classList.add('is-live');
    items[1].classList.remove('is-on');
    items[2].classList.remove('is-on');

    gsap
      .timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: wrap,
          start: row ? 'clamp(top 72%)' : 'clamp(top 70%)',
          end: row ? 'clamp(top 28%)' : 'clamp(bottom 60%)',
          scrub: 0.5,
          invalidateOnRefresh: true,
          onRefresh: measure,
          onUpdate: (self) => {
            items[1].classList.toggle('is-on', self.progress >= 0.499);
            items[2].classList.toggle('is-on', self.progress >= 0.995);
          },
        },
      })
      .fromTo(fill, row ? { scaleX: 0 } : { scaleY: 0 }, row ? { scaleX: 1 } : { scaleY: 1 }, 0)
      .fromTo(index, row ? { x: 0 } : { y: 0 }, row ? { x: reach } : { y: reach }, 0);

    return () => {
      list.classList.remove('is-live');
      items.forEach((item) => item.classList.add('is-on'));
      wrap.style.removeProperty('--reach');
    };
  });
}

/* ---------- Closing: the ink panel scales up to full bleed ---------- */
function closing() {
  const section = $('.closing');
  const panel = section && $('.closing-bg', section);
  if (!panel || !below(section)) return;

  gsap.fromTo(
    panel,
    { scale: 0.92 },
    {
      scale: 1,
      ease: 'none',
      transformOrigin: '50% 100%',
      // clamp: on tall screens the section's top can never reach 35%, so finish at the end of the page
      scrollTrigger: { trigger: section, start: 'clamp(top bottom)', end: 'clamp(top 35%)', scrub: 0.4 },
    }
  );
}

/* ---------- FAQ: opening an answer changes the page height ---------- */
function faq() {
  $$('.faq details').forEach((item) => item.addEventListener('toggle', () => ScrollTrigger.refresh()));
}
