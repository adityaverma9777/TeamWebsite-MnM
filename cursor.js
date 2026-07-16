import { gsap } from 'gsap';

export function initCursor() {
  const cursorInner = document.getElementById('cursor-inner');
  const cursorOuter = document.getElementById('cursor-outer');
  const cursorLabel = document.getElementById('cursor-label');
  
  if (!cursorInner || !cursorOuter) return;

  let mouseX = window.innerWidth / 2;
  let mouseY = window.innerHeight / 2;
  let outerX = mouseX;
  let outerY = mouseY;

  window.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    cursorInner.style.transform = `translate3d(calc(${mouseX}px - 50%), calc(${mouseY}px - 50%), 0)`;
  }, { passive: true });

  gsap.ticker.add(() => {
    outerX += (mouseX - outerX) * 0.18;
    outerY += (mouseY - outerY) * 0.18;
    gsap.set(cursorOuter, { x: outerX, y: outerY });
  });

  document.addEventListener('mousedown', () => gsap.to(cursorOuter, { scale: 0.75, duration: 0.12, ease: 'power2.out' }));
  document.addEventListener('mouseup', () => gsap.to(cursorOuter, { scale: 1, duration: 0.2, ease: 'elastic.out(1,0.5)' }));
  
  document.querySelectorAll('[data-cursor]').forEach(el => {
    el.addEventListener('mouseenter', () => {
      if(cursorLabel) cursorLabel.textContent = el.dataset.cursor;
      cursorOuter.classList.add('expanded');
      gsap.to(cursorInner, { opacity: 0, duration: 0.2 });
    });
    el.addEventListener('mouseleave', () => {
      cursorOuter.classList.remove('expanded');
      if(cursorLabel) cursorLabel.textContent = '';
      gsap.to(cursorInner, { opacity: 1, duration: 0.2 });
    });
  });
}
