// Run before styles load so a saved theme never flashes the opposite palette.
(() => {
  let theme = 'dark';
  try {
    if (localStorage.getItem('portfolio-theme') === 'light') theme = 'light';
  } catch { /* The toggle still works when browser storage is unavailable. */ }

  const applyTheme = () => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]').content = theme === 'light' ? '#f5f4f0' : '#0c0c0c';
  };
  applyTheme();

  document.addEventListener('DOMContentLoaded', () => {
    const button = document.querySelector('.theme-toggle');
    if (!button) return;
    const updateLabel = () => {
      button.setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`);
      button.title = button.getAttribute('aria-label');
    };
    button.hidden = false;
    updateLabel();
    button.addEventListener('click', () => {
      theme = theme === 'dark' ? 'light' : 'dark';
      applyTheme();
      updateLabel();
      try { localStorage.setItem('portfolio-theme', theme); } catch { /* Optional persistence. */ }
    });
  });
})();
