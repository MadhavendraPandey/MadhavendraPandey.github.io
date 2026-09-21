export function initLightPanels() {
  const enabled = matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)');
  document.querySelectorAll('.light-panel').forEach(panel => {
    let frame = 0;
    let point;
    const reset = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      for (const name of ['--tilt-x', '--tilt-y', '--parallax-x', '--parallax-y', '--light-opacity']) {
        panel.style.removeProperty(name);
      }
    };
    panel.addEventListener('pointermove', event => {
      if (!enabled.matches || event.pointerType === 'touch') return;
      point = {x: event.clientX, y: event.clientY};
      if (frame) return;
      frame = requestAnimationFrame(() => {
        // One layout read before all writes, at most once per pointer frame.
        const bounds = panel.getBoundingClientRect();
        const x = Math.max(0, Math.min(1, (point.x - bounds.left) / bounds.width));
        const y = Math.max(0, Math.min(1, (point.y - bounds.top) / bounds.height));
        panel.style.setProperty('--pointer-x', `${x * 100}%`);
        panel.style.setProperty('--pointer-y', `${y * 100}%`);
        panel.style.setProperty('--tilt-x', `${(0.5 - y) * 2}deg`);
        panel.style.setProperty('--tilt-y', `${(x - 0.5) * 2}deg`);
        panel.style.setProperty('--parallax-x', `${(x - 0.5) * 5}px`);
        panel.style.setProperty('--parallax-y', `${(y - 0.5) * 5}px`);
        panel.style.setProperty('--light-opacity', '1');
        frame = 0;
      });
    }, {passive: true});
    panel.addEventListener('pointerleave', reset);
    panel.addEventListener('pointercancel', reset);
    enabled.addEventListener('change', reset);
    window.addEventListener('blur', reset);
  });
}
