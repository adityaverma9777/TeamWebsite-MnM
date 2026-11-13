import { gsap } from 'gsap';
export function initCursor() {
  const isMobile = () => window.innerWidth <= 960 || window.matchMedia('(hover: none), (pointer: coarse)').matches;
  let cursor = document.getElementById('furrow-cursor');
  if (!cursor) {
    cursor = document.createElement('div');
    cursor.id = 'furrow-cursor';
    document.body.appendChild(cursor);
  }
  const oldInner = document.getElementById('cursor-inner');
  const oldOuter = document.getElementById('cursor-outer');
  if (oldInner) oldInner.style.display = 'none';
  if (oldOuter) oldOuter.style.display = 'none';
  if (isMobile()) {
    cursor.style.display = 'none';
  }
  let mouseX = window.innerWidth / 2;
  let mouseY = window.innerHeight / 2;
  let cursorX = mouseX;
  let cursorY = mouseY;
  let lockedTarget = null;
  let isHovered = false;
  window.addEventListener('touchstart', () => {
    cursor.style.display = 'none';
    lockedTarget = null;
  }, { passive: true });
  window.addEventListener('resize', () => {
    if (isMobile()) {
      cursor.style.display = 'none';
      lockedTarget = null;
    } else {
      cursor.style.display = '';
    }
  });
  window.addEventListener('mousemove', (e) => {
    if (isMobile()) return;
    cursor.style.display = '';
    mouseX = e.clientX;
    mouseY = e.clientY;
  }, { passive: true });
  gsap.ticker.add(() => {
    if (isMobile()) return;
    let targetX = mouseX;
    let targetY = mouseY;
    if (lockedTarget) {
      const rect = lockedTarget.getBoundingClientRect();
      targetX = rect.left + rect.width / 2;
      targetY = rect.top + rect.height / 2;
    }
    cursorX += (targetX - cursorX) * 0.25;
    cursorY += (targetY - cursorY) * 0.25;
    cursor.style.transform = `translate3d(${cursorX}px, ${cursorY}px, 0)`;
  });
  document.addEventListener('mousedown', (e) => {
    if (isMobile() || e.pointerType === 'touch') return;
    cursor.classList.add('pressed');
  });
  document.addEventListener('mouseup', () => {
    if (isMobile()) return;
    cursor.classList.remove('pressed');
  });
  const interactiveSelectors = 'a, button, .btn-pill, .magnetic, .navbar-cta, .nav-link, [data-cursor], .accordion-toggle, input, select, textarea';
  function bindInteractive(el) {
    el.addEventListener('mouseenter', (e) => {
      if (isMobile() || e.pointerType === 'touch') return;
      isHovered = true;
      cursor.classList.add('bordered');
      if (el.classList.contains('magnetic') || el.classList.contains('navbar-cta') || el.classList.contains('btn-pill')) {
        lockedTarget = el;
      }
    });
    el.addEventListener('mouseleave', () => {
      if (isMobile()) return;
      isHovered = false;
      cursor.classList.remove('bordered');
      lockedTarget = null;
    });
  }
  document.querySelectorAll(interactiveSelectors).forEach(bindInteractive);
  const observer = new MutationObserver(() => {
    document.querySelectorAll(interactiveSelectors).forEach(bindInteractive);
  });
  observer.observe(document.body, { childList: true, subtree: true });
}