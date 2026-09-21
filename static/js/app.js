import {initLightPanels} from './light-panel.js';
import {initScroll} from './scroll.js';
import {initKeycap} from './keycap.js?v=15';

initLightPanels();
initKeycap();
// Defer until the optional GSAP scripts have finished loading or failed.
if (document.readyState === 'complete') initScroll();
else window.addEventListener('load', initScroll, {once: true});
