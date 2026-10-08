const nav = document.getElementById('cat-nav');
window.addEventListener('scroll', () => {
  nav.classList.toggle('scrolled', window.scrollY > 40);
}, { passive: true });
const menuToggle = document.getElementById('cat-menu-toggle');
const mobileMenu = document.getElementById('cat-mobile-menu');
const mobileClose = document.getElementById('cat-mobile-close');
function openMenu() { mobileMenu.classList.add('open'); menuToggle.setAttribute('aria-expanded','true'); document.body.style.overflow = 'hidden'; }
function closeMenu() { mobileMenu.classList.remove('open'); menuToggle.setAttribute('aria-expanded','false'); document.body.style.overflow = ''; }
menuToggle.addEventListener('click', openMenu);
mobileClose.addEventListener('click', closeMenu);
mobileMenu.querySelectorAll('a').forEach(a => a.addEventListener('click', closeMenu));
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });
const REG_CLOSE = new Date('2026-11-07T23:59:59+05:30');
const HACK_START = new Date('2026-11-08T10:00:00+05:30');
const HACK_END = new Date('2026-11-08T20:00:00+05:30');
const labelEl = document.getElementById('cat-countdown-label');
const gridEl = document.getElementById('cat-countdown-grid');
const dEl = document.getElementById('cd-days');
const hEl = document.getElementById('cd-hours');
const mEl = document.getElementById('cd-mins');
const sEl = document.getElementById('cd-secs');
function pad(n) { return String(n).padStart(2, '0'); }
function updateCountdown() {
  const now = new Date();
  if (now >= HACK_END) {
    labelEl.textContent = 'Catalyst has concluded';
    gridEl.innerHTML = '<p class="cat-concluded">Thank you for building.</p>';
    return;
  }
  if (now >= HACK_START) {
    labelEl.textContent = 'Catalyst is live';
    gridEl.innerHTML = '<p class="cat-concluded" style="color:var(--red-light)">Build. Prompt. Ship.</p>';
    return;
  }
  const target = now < REG_CLOSE ? REG_CLOSE : HACK_START;
  labelEl.textContent = now < REG_CLOSE ? 'Registration closes in' : 'Catalyst starts in';
  const diff = Math.max(0, target - now);
  dEl.textContent = pad(Math.floor(diff / 86400000));
  hEl.textContent = pad(Math.floor((diff % 86400000) / 3600000));
  mEl.textContent = pad(Math.floor((diff % 3600000) / 60000));
  sEl.textContent = pad(Math.floor((diff % 60000) / 1000));
}
updateCountdown();
setInterval(updateCountdown, 1000);
const reveals = document.querySelectorAll('.cat-reveal');
const io = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); }
  });
}, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
reveals.forEach(el => io.observe(el));
const canvas = document.getElementById('cat-hero-canvas');
if (canvas) {
  const ctx = canvas.getContext('2d');
  let w, h;
  const particles = [];
  function resize() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
    particles.length = 0;
    const count = Math.min(80, Math.floor(w / 18));
    for (let i = 0; i < count; i++) {
      particles.push({ x: Math.random()*w, y: Math.random()*h, vx: (Math.random()-.5)*.3, vy: (Math.random()-.5)*.3, r: Math.random()*1.5+.5, o: Math.random()*.4+.1 });
    }
  }
  resize();
  window.addEventListener('resize', resize, { passive: true });
  function drawFrame() {
    requestAnimationFrame(drawFrame);
    ctx.clearRect(0, 0, w, h);
    particles.forEach(p => {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0) p.x = w; if (p.x > w) p.x = 0;
      if (p.y < 0) p.y = h; if (p.y > h) p.y = 0;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
      ctx.fillStyle = `rgba(229,57,53,${p.o})`;
      ctx.fill();
    });
    for (let i = 0; i < particles.length; i++) {
      for (let j = i+1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist < 120) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(229,57,53,${.08*(1-dist/120)})`;
          ctx.lineWidth = .5;
          ctx.stroke();
        }
      }
    }
  }
  drawFrame();
}
