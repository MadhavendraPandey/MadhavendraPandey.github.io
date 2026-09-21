const cursorMedia = window.matchMedia('(hover: hover) and (pointer: fine)');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const cursor = document.querySelector('.custom-cursor');

if (cursor) {
  const interactive = 'a, button, [role="button"], summary';
  const editable = 'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]';
  const enabled = () => cursorMedia.matches && !reducedMotion.matches && !document.hidden;
  let frame = 0;
  let x = 0;
  let y = 0;

  const hide = () => {
    cancelAnimationFrame(frame);
    frame = 0;
    cursor.classList.remove('is-visible', 'is-hovering', 'is-pressed');
    document.body.classList.remove('has-custom-cursor');
  };
  const render = () => {
    frame = 0;
    // No trailing interpolation: the arrow tip stays on the click position.
    cursor.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  };
  const move = event => {
    if (!enabled() || event.pointerType === 'touch' || event.target.closest?.(editable)) {
      hide();
      return;
    }
    x = event.clientX;
    y = event.clientY;
    cursor.classList.toggle('is-hovering', !!event.target.closest?.(interactive));
    if (!cursor.classList.contains('is-visible')) render();
    else if (!frame) frame = requestAnimationFrame(render);
    cursor.classList.add('is-visible');
    document.body.classList.add('has-custom-cursor');
  };

  document.addEventListener('pointermove', move, {passive: true});
  document.addEventListener('pointerover', move, {passive: true});
  document.addEventListener('pointerdown', event => {
    move(event);
    if (cursor.classList.contains('is-visible')) {
      // Paint the exact click location even if a move frame is pending.
      cancelAnimationFrame(frame);
      render();
      cursor.classList.add('is-pressed');
    }
  }, {passive: true});
  document.addEventListener('pointerup', () => cursor.classList.remove('is-pressed'), {passive: true});
  document.addEventListener('pointercancel', hide, {passive: true});
  document.documentElement.addEventListener('pointerleave', hide, {passive: true});
  document.addEventListener('keydown', event => { if (event.key === 'Tab') hide(); });
  document.addEventListener('visibilitychange', hide);
  window.addEventListener('blur', hide);
  window.addEventListener('pagehide', hide);
  cursorMedia.addEventListener('change', hide);
  reducedMotion.addEventListener('change', hide);
}
