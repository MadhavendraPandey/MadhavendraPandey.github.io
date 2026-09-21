export function initScroll() {
  // Content stays in place; only project entrances use a small optional motion.
  if (!window.gsap || !window.ScrollTrigger) return;
  const {gsap, ScrollTrigger} = window;
  gsap.registerPlugin(ScrollTrigger);
  gsap.matchMedia().add('(prefers-reduced-motion: no-preference)', () => {
    document.querySelectorAll('.project-card').forEach(card => {
      gsap.fromTo(card, {translate: '0 12px'}, {
        translate: '0 0', duration: 0.5, ease: 'power2.out',
        scrollTrigger: {trigger: card, start: 'top 95%', once: true}
      });
    });
  });
}
