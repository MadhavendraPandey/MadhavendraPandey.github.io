export function initKeycap() {
  const hero = document.querySelector('.hero-scroll');
  const intro = hero?.querySelector('.intro');
  const scene = hero?.querySelector('.keycap-scene');
  const key = scene?.querySelector('.keycap-object');
  const greeting = hero?.querySelector('.intro-greeting');
  const identity = hero?.querySelector('.intro-identity');
  const discipline = hero?.querySelector('.intro-discipline');
  if (!hero || !intro || !scene || !key || !greeting || !identity || !discipline) return;

  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const compact = window.matchMedia('(max-width: 900px)');
  const phone = window.matchMedia('(max-width: 600px)');
  const heroStart = hero.getBoundingClientRect().top + window.scrollY;
  let scrollProgress = 0;
  let currentProgress = 0;
  let pointerX = 0;
  let pointerY = 0;
  let currentX = -36;
  let currentY = -20;
  let frame = 0;
  let initialized = false;

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const smooth = (start, end, value) => {
    const t = clamp((value - start) / (end - start), 0, 1);
    return t * t * (3 - 2 * t);
  };
  const updateScroll = () => {
    if (motion.matches) scrollProgress = 1;
    else {
      const box = hero.getBoundingClientRect();
      const travel = Math.max(1, box.height - intro.getBoundingClientRect().height);
      scrollProgress = clamp((heroStart - box.top) / travel, 0, 1);
    }
    if (!initialized) { currentProgress = scrollProgress; initialized = true; }
    requestRender();
  };
  const render = () => {
    frame = 0;
    const easing = motion.matches ? 1 : .18;
    currentProgress += (scrollProgress - currentProgress) * easing;
    const progress = currentProgress;
    const greetingMove = smooth(.2, .5, progress);
    const greetingFade = compact.matches ? smooth(.34, .49, progress) : smooth(.43, .58, progress);
    const nameEnter = smooth(.3, .65, progress);
    const nameFade = smooth(.32, .55, progress);
    const disciplineEnter = smooth(.65, .85, progress);
    const turn = smooth(.12, .98, progress);
    const greetingDistance = compact.matches ? 76 : 138;
    const nameDistance = phone.matches ? 36 : compact.matches ? 42 : 70;

    greeting.style.transform = `translateY(${-greetingDistance * greetingMove}px)`;
    greeting.style.opacity = String(1 - greetingFade);
    identity.style.transform = `translateY(${nameDistance * (1 - nameEnter)}px)`;
    identity.style.opacity = String(nameFade);
    discipline.style.transform = `translateY(${18 * (1 - disciplineEnter)}px)`;
    discipline.style.opacity = String(disciplineEnter);
    const targetX = -36 + turn * 8 + (motion.matches ? 0 : pointerY);
    const targetY = -20 + turn * 68 + (motion.matches ? 0 : pointerX);
    currentX += (targetX - currentX) * easing;
    currentY += (targetY - currentY) * easing;
    key.style.transform = `rotateX(${currentX}deg) rotateY(${currentY}deg) rotateZ(-3deg) scale(var(--key-scale))`;
    if (Math.abs(scrollProgress - currentProgress) > .001 || Math.abs(targetX - currentX) > .05 || Math.abs(targetY - currentY) > .05) requestRender();
  };
  function requestRender() { if (!frame && !document.hidden) frame = requestAnimationFrame(render); }

  hero.addEventListener('pointermove', event => {
    if (motion.matches || event.pointerType === 'touch') return;
    const box = hero.getBoundingClientRect();
    pointerX = clamp((event.clientX - box.left) / box.width - .5, -.5, .5) * 3;
    pointerY = clamp((event.clientY - box.top) / box.height - .5, -.5, .5) * -2;
    requestRender();
  }, {passive: true});
  hero.addEventListener('pointerleave', () => { pointerX = 0; pointerY = 0; requestRender(); });
  window.addEventListener('scroll', updateScroll, {passive: true});
  window.addEventListener('resize', updateScroll);
  motion.addEventListener('change', updateScroll);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) updateScroll(); });
  updateScroll();
}
