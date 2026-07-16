import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { TextPlugin } from 'gsap/TextPlugin';
import { ScrollToPlugin } from 'gsap/ScrollToPlugin';
import SplitType from 'split-type';
import Lenis from 'lenis';
import { initAuth } from './auth.js';
import { initCursor } from './cursor.js';
import { sanityClient } from './sanity.js';
import imageUrlBuilder from '@sanity/image-url';
import * as THREE from 'three';

// Wake up Render backend
const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
fetch(`${backendUrl}/wake`).catch(() => {});

const builder = imageUrlBuilder(sanityClient);
function urlFor(source) {
  return builder.image(source);
}

gsap.registerPlugin(ScrollTrigger, TextPlugin, ScrollToPlugin);

const lenis = new Lenis({
  duration: 1.1,
  easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  smoothWheel: true,
  autoRaf: false,
});

lenis.on('scroll', ScrollTrigger.update);

gsap.ticker.add((time) => {
  lenis.raf(time * 1000);
});
gsap.ticker.lagSmoothing(0);

initCursor();

document.querySelectorAll('.magnetic, .navbar-cta').forEach(el => {
  const qx = gsap.quickTo(el, 'x', { duration: 0.4, ease: 'power2.out' });
  const qy = gsap.quickTo(el, 'y', { duration: 0.4, ease: 'power2.out' });
  el.addEventListener('mousemove', (e) => {
    const rect = el.getBoundingClientRect();
    qx((e.clientX - rect.left - rect.width / 2) * 0.32);
    qy((e.clientY - rect.top - rect.height / 2) * 0.32);
  });
  el.addEventListener('mouseleave', () => {
    gsap.to(el, { x: 0, y: 0, duration: 0.6, ease: 'elastic.out(1, 0.5)' });
  });
});
const heroCta = document.getElementById('hero-cta');
if (heroCta) {
  heroCta.addEventListener('click', () => {
    lenis.scrollTo(document.getElementById('contributors'));
  });
}
function initPreloader() {
  const tl = gsap.timeline({ onComplete: initSite });
  tl.to('#preloader-line', { width: 280, duration: 0.6, ease: 'expo.out' }, 0);
  tl.to('#preloader-text', { opacity: 1, duration: 0.1 }, 0.5);
  tl.to('#preloader-text', {
    duration: 0.4,
    text: { value: 'loading', delimiter: '' },
    ease: 'none'
  }, 0.5);
  tl.to('#preloader-progress', { width: '100%', duration: 0.8, ease: 'power2.inOut' }, 0.9);
  tl.to(['#preloader-text', '#preloader-line'], { opacity: 0, duration: 0.2 }, 1.7);
  tl.to('#preloader', { clipPath: 'inset(0 0 100% 0)', duration: 0.5, ease: 'expo.in' }, 1.9);
  tl.set('#preloader', { display: 'none' }, 2.5);
}
function initSite() {
  gsap.to('#navbar', { y: 0, opacity: 1, duration: 0.55, ease: 'expo.out' });
  gsap.to('.hero-label', { opacity: 1, duration: 0.5, ease: 'expo.out', delay: 0.1 });
  const heroHeading = document.querySelector('#hero-heading');
  if (heroHeading && typeof SplitType !== 'undefined') {
    const split = new SplitType(heroHeading, { types: 'chars,words' });
    gsap.from(split.chars, {
      y: '110%',
      rotation: 5,
      opacity: 0,
      duration: 0.85,
      ease: 'expo.out',
      stagger: 0.018
    });
    heroHeading.addEventListener('mousemove', (e) => {
      if (!split.words) return;
      split.words.forEach(word => {
        const rect = word.getBoundingClientRect();
        const dist = Math.hypot(e.clientX - (rect.left + rect.width / 2), e.clientY - (rect.top + rect.height / 2));
        const w = gsap.utils.mapRange(0, 280, 680, 400, Math.min(dist, 280));
        gsap.to(word, { fontVariationSettings: `'wght' ${w}`, duration: 0.3 });
      });
    });
  }
  gsap.to('.hero-sub', { y: 0, opacity: 1, duration: 0.65, ease: 'expo.out', delay: 0.55 });
  gsap.to('.hero-cta-row', { opacity: 1, duration: 0.5, ease: 'expo.out', delay: 0.75 });
  initScrollAnimations();
  initAboutScroll();
  initPersonCards();
  initManifesto();
  initProjectCards();
  initHackathons();
  initNavHighlight();
  initNavbarCollapse();
  initMobileMenu();
  initAboutPageAnimations();
  initCompPageAnimations();
  initContributePageAnimations();
  initSponsorsPageAnimations();
  initAuth();
  
  if (document.getElementById('home-sponsors-timeline-wrap')) {
    window.loadHomepageSponsors();
    window.loadLeaderboard();
  }
}
function initNavbarCollapse() {
  const navbar = document.getElementById('navbar');
  if (!navbar) return;
  let lastScrollY = window.scrollY;
  let collapsed = false;

  const threshold = 30;
  const delta = 10;

  gsap.ticker.add(() => {
    const currentY = window.scrollY;
    const diff = currentY - lastScrollY;

    if (currentY > threshold && diff > delta && !collapsed) {
      navbar.classList.add('collapsed');
      collapsed = true;
      lastScrollY = currentY;
    } else if (diff < -delta && collapsed) {
      navbar.classList.remove('collapsed');
      collapsed = false;
      lastScrollY = currentY;
    } else if (diff > 0 && currentY > lastScrollY) {
      lastScrollY = currentY;
    } else if (diff < 0 && currentY < lastScrollY) {
      lastScrollY = currentY;
    }
  });
}

function initMobileMenu() {
  const menuToggle = document.getElementById('menu-toggle');
  const navbarLinks = document.getElementById('navbar-links');
  const navLinks = document.querySelectorAll('.nav-link');
  const navbar = document.getElementById('navbar');

  if (menuToggle && navbarLinks && navbar) {
    menuToggle.addEventListener('click', () => {
      menuToggle.classList.toggle('active');
      navbarLinks.classList.toggle('active');
      navbar.classList.toggle('menu-open');
    });

    navLinks.forEach(link => {
      link.addEventListener('click', () => {
        menuToggle.classList.remove('active');
        navbarLinks.classList.remove('active');
        navbar.classList.remove('menu-open');
      });
    });
  }
}

function initScrollAnimations() {
  gsap.utils.toArray('.hack-line, .contact-line').forEach(el => {
    gsap.from(el, {
      y: 40,
      opacity: 0,
      duration: 0.8,
      ease: 'expo.out',
      scrollTrigger: { trigger: el, start: 'top 88%', once: true }
    });
  });
  gsap.utils.toArray('.stack-line').forEach((el, i) => {
    gsap.from(el, {
      y: 36,
      opacity: 0,
      duration: 0.75,
      ease: 'expo.out',
      delay: i * 0.08,
      scrollTrigger: { trigger: '.stack-heading', start: 'top 80%', once: true }
    });
  });
  gsap.utils.toArray('.stack-category').forEach((el, i) => {
    gsap.from(el, {
      x: -24,
      opacity: 0,
      duration: 0.65,
      ease: 'expo.out',
      delay: i * 0.07,
      scrollTrigger: { trigger: '.stack-grid-section', start: 'top 82%', once: true }
    });
  });
  gsap.utils.toArray('.tech-icon-card').forEach((el, i) => {
    gsap.from(el, {
      y: 14,
      opacity: 0,
      duration: 0.45,
      ease: 'expo.out',
      delay: 0.15 + i * 0.03,
      scrollTrigger: { trigger: '.stack-grid-section', start: 'top 80%', once: true }
    });
  });
  gsap.from('.projects-heading', {
    y: 28,
    opacity: 0,
    duration: 0.7,
    ease: 'expo.out',
    scrollTrigger: { trigger: '.projects-heading', start: 'top 85%', once: true }
  });
  gsap.utils.toArray('.contact-row').forEach((el, i) => {
    gsap.from(el, {
      x: -28,
      opacity: 0,
      duration: 0.6,
      ease: 'expo.out',
      delay: i * 0.1,
      scrollTrigger: { trigger: '.contact-links', start: 'top 82%', once: true }
    });
  });
  gsap.from('.contact-heading', {
    y: 32,
    opacity: 0,
    duration: 0.75,
    ease: 'expo.out',
    scrollTrigger: { trigger: '.contact-heading', start: 'top 82%', once: true }
  });
}
function initAboutScroll() {
  const aboutSection = document.getElementById('about');
  if (!aboutSection) return;
  const photo = document.querySelector('.about-photo');
  gsap.utils.toArray('.about-text-col .about-line').forEach((el, i) => {
    gsap.from(el, {
      y: 36,
      opacity: 0,
      duration: 0.8,
      ease: 'expo.out',
      delay: i * 0.1,
      scrollTrigger: { trigger: '#about', start: 'top 75%', once: true }
    });
  });
  gsap.from('.about-text-col .section-label', {
    opacity: 0,
    duration: 0.5,
    ease: 'expo.out',
    scrollTrigger: { trigger: '#about', start: 'top 75%', once: true }
  });
  gsap.from('.about-text-col .about-body', {
    y: 20,
    opacity: 0,
    duration: 0.65,
    ease: 'expo.out',
    delay: 0.38,
    scrollTrigger: { trigger: '#about', start: 'top 75%', once: true }
  });
  ScrollTrigger.create({
    trigger: '#about',
    start: 'top 75%',
    once: true,
    onEnter: () => {
      if (photo) gsap.to(photo, { opacity: 1, duration: 1.2, ease: 'expo.out', delay: 0.15 });
      setTimeout(() => {
        document.getElementById('card-aditya').classList.add('visible');
      }, 900);
      setTimeout(() => {
        document.getElementById('card-manika').classList.add('visible');
      }, 1150);
    }
  });
}
function initPersonCards() {
  [0, 1].forEach(i => {
    const canvas = document.getElementById(`water-canvas-${i}`);
    if (!canvas) return;
    const card = canvas.parentElement;
    const W = card.offsetWidth || 172;
    const H = card.offsetHeight || 80;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    let t = 0;
    const ripples = [];
    card.addEventListener('click', (e) => {
      const rect = card.getBoundingClientRect();
      ripples.push({ x: e.clientX - rect.left, y: e.clientY - rect.top, r: 0, max: Math.max(W, H) * 1.4, alpha: 0.4 });
    });
    function drawWater() {
      requestAnimationFrame(drawWater);
      t += 0.018;
      ctx.clearRect(0, 0, W, H);
      const imageData = ctx.createImageData(W, H);
      const data = imageData.data;
      for (let x = 0; x < W; x++) {
        for (let y = 0; y < H; y++) {
          const wave1 = Math.sin(x * 0.06 + t) * Math.cos(y * 0.08 - t * 0.7);
          const wave2 = Math.sin((x + y) * 0.05 + t * 0.5) * 0.6;
          const wave3 = Math.cos(x * 0.04 - y * 0.06 + t * 1.1) * 0.4;
          const combined = (wave1 + wave2 + wave3) / 3;
          const brightness = 128 + combined * 38;
          const idx = (y * W + x) * 4;
          data[idx] = 180 + combined * 30;
          data[idx + 1] = 210 + combined * 20;
          data[idx + 2] = 240 + combined * 15;
          data[idx + 3] = Math.abs(combined) * 40 + 10;
        }
      }
      ctx.putImageData(imageData, 0, 0);
      ripples.forEach((rip, ri) => {
        rip.r += 2.5;
        rip.alpha -= 0.008;
        if (rip.alpha <= 0) { ripples.splice(ri, 1); return; }
        ctx.beginPath();
        ctx.arc(rip.x, rip.y, rip.r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(180,230,255,${rip.alpha})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      });
    }
    drawWater();
  });
}

function initManifesto() {
  const section = document.getElementById('manifesto');
  if (!section) return;

  gsap.to('body', {
    backgroundColor: '#050505',
    ease: 'none',
    scrollTrigger: {
      trigger: section,
      start: 'top 80%',
      end: 'top 20%',
      scrub: 0.6
    }
  });

  gsap.to('body', {
    backgroundColor: '#FFFFFF',
    ease: 'none',
    scrollTrigger: {
      trigger: section,
      start: 'bottom 80%',
      end: 'bottom 20%',
      scrub: 0.6
    }
  });

  document.querySelectorAll('.manifesto-line').forEach((el, i) => {
    ScrollTrigger.create({
      trigger: el,
      start: 'top 82%',
      once: true,
      onEnter: () => {
        gsap.to(el, {
          clipPath: 'inset(0 0 0% 0)',
          duration: 0.75,
          ease: 'expo.out',
          delay: i * 0.18
        });
      }
    });
  });

  ScrollTrigger.create({
    trigger: '.manifesto-rule',
    start: 'top 80%',
    once: true,
    onEnter: () => {
      setTimeout(() => {
        gsap.to('.manifesto-rule', { width: '100%', duration: 0.8, ease: 'expo.out' });
        setTimeout(() => gsap.to('.manifesto-credit', { opacity: 1, duration: 0.5 }), 900);
      }, 1200);
    }
  });
}
function initProjectCards() {
  const track = document.getElementById('projects-track');
  const cards = document.querySelectorAll('.project-card');
  cards.forEach(card => {
    const link = card.querySelector('.card-link');
    if (link) {
      card.style.cursor = 'pointer';
      card.addEventListener('click', (e) => {
        if (e.target !== link) link.click();
      });
    }

    const qRotX = gsap.quickTo(card, 'rotateX', { duration: 0.45, ease: 'power2.out' });
    const qRotY = gsap.quickTo(card, 'rotateY', { duration: 0.45, ease: 'power2.out' });
    const qScale = gsap.quickTo(card, 'scale', { duration: 0.45, ease: 'power2.out' });
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = (e.clientX - rect.left - rect.width / 2) / (rect.width / 2);
      const y = (e.clientY - rect.top - rect.height / 2) / (rect.height / 2);
      gsap.set(card, { transformPerspective: 900 });
      qRotX(y * -7);
      qRotY(x * 7);
      qScale(1.02);
    });
    card.addEventListener('mouseleave', () => {
      gsap.to(card, { rotateX: 0, rotateY: 0, scale: 1, duration: 0.5, ease: 'expo.out' });
    });
  });

  if (track) {
    let trackScrollSpeed = 0;
    track.addEventListener('mousemove', (e) => {
      if (window.innerWidth <= 960) return;
      const rect = track.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const width = rect.width;
      const edgeSize = 150;
      if (x > width - edgeSize) {
        trackScrollSpeed = ((x - (width - edgeSize)) / edgeSize) * 18;
      } else if (x < edgeSize) {
        trackScrollSpeed = -((edgeSize - x) / edgeSize) * 18;
      } else {
        trackScrollSpeed = 0;
      }
    });
    track.addEventListener('mouseleave', () => {
      trackScrollSpeed = 0;
    });
    function trackScrollLoop() {
      if (trackScrollSpeed !== 0) {
        track.scrollLeft += trackScrollSpeed;
      }
      requestAnimationFrame(trackScrollLoop);
    }
    trackScrollLoop();
  }
}
function initHackathons() {
  const watermark = document.getElementById('hack-watermark');
  document.querySelectorAll('.hack-entry').forEach((entry, i) => {
    const stem = entry.querySelector('.hack-stem');
    const card = entry.querySelector('.hack-card');
    ScrollTrigger.create({
      trigger: entry,
      start: 'top 82%',
      once: true,
      onEnter: () => {
        gsap.to(stem, { scaleY: 1, duration: 0.55, ease: 'expo.out' });
        gsap.to(card, { opacity: 1, y: 0, duration: 0.45, ease: 'expo.out', delay: 0.45 });
        gsap.to(watermark, {
          textContent: i + 1,
          duration: 0.01,
          delay: 0.1,
          onUpdate: () => { watermark.textContent = i + 1; }
        });
      }
    });
  });

  const scrollContainer = document.getElementById('hack-timeline-scroll');
  if (scrollContainer) {
    let scrollSpeed = 0;
    scrollContainer.addEventListener('mousemove', (e) => {
      if (window.innerWidth <= 960) return;
      const rect = scrollContainer.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const width = rect.width;
      const edgeSize = 150;
      if (x > width - edgeSize) {
        scrollSpeed = ((x - (width - edgeSize)) / edgeSize) * 18;
      } else if (x < edgeSize) {
        scrollSpeed = -((edgeSize - x) / edgeSize) * 18;
      } else {
        scrollSpeed = 0;
      }
    });
    scrollContainer.addEventListener('mouseleave', () => {
      scrollSpeed = 0;
    });
    function scrollLoop() {
      if (scrollSpeed !== 0) {
        scrollContainer.scrollLeft += scrollSpeed;
      }
      requestAnimationFrame(scrollLoop);
    }
    scrollLoop();
  }
}
function initNavHighlight() {
  const links = document.querySelectorAll('.nav-link');
  ['hero', 'projects', 'about', 'contact'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    ScrollTrigger.create({
      trigger: el,
      start: 'top 50%',
      end: 'bottom 50%',
      onEnter: () => links.forEach(l => l.classList.toggle('active', l.dataset.section === id)),
      onEnterBack: () => links.forEach(l => l.classList.toggle('active', l.dataset.section === id))
    });
  });
}
function initHeroDisplacement() {
  const canvas = document.getElementById('hero-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let W, H, t = 0;
  let mx = 0, my = 0;
  let frameCount = 0;
  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
    mx = W / 2;
    my = H / 2;
  }
  resize();
  window.addEventListener('resize', resize);
  window.addEventListener('mousemove', (e) => {
    mx += (e.clientX - mx) * 0.06;
    my += (e.clientY - my) * 0.06;
  });
  const STEP = 48;
  function draw() {
    requestAnimationFrame(draw);
    frameCount++;
    if (frameCount % 2 !== 0) return;
    t += 0.005;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, W, H);
    for (let x = 0; x <= W; x += STEP) {
      for (let y = 0; y <= H; y += STEP) {
        const dx = (x - mx) / W;
        const dy = (y - my) / H;
        const n = Math.sin(x * 0.004 + t) * Math.cos(y * 0.004 - t * 0.6)
          + Math.sin((x + y) * 0.003 + t * 0.4) * 0.6
          + Math.cos(Math.sqrt(dx * dx + dy * dy) * 8 - t * 0.5) * 0.4;
        const norm = n / 2;
        const alpha = Math.abs(norm) * 0.09;
        const lightness = 94 + norm * 5;
        ctx.fillStyle = `hsla(0,0%,${lightness}%,${alpha})`;
        const size = STEP + norm * 5;
        ctx.fillRect(x - size / 2, y - size / 2, size, size);
      }
    }
  }
  draw();
}

function initAboutPageAnimations() {
  const isAboutPage = document.querySelector('#about-hero');
  if (!isAboutPage) return;

  gsap.from('.about-fade-in', {
    y: 30,
    opacity: 0,
    duration: 1,
    stagger: 0.2,
    ease: 'power3.out',
    delay: 0.4
  });

  gsap.utils.toArray('.about-slide-up').forEach((el) => {
    gsap.from(el, {
      y: 40,
      opacity: 0,
      duration: 0.8,
      ease: 'expo.out',
      scrollTrigger: { trigger: el, start: 'top 85%', once: true }
    });
  });

  initAboutHeroCanvas();
}

function initAboutHeroCanvas() {
  const canvas = document.getElementById('about-hero-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let w, h, t = 0;
  function resize() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);
  
  function draw() {
    requestAnimationFrame(draw);
    t += 0.01;
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, w, h);
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(200, 255, 0, 0.05)';
    
    ctx.beginPath();
    for (let i = 0; i < h; i += 40) {
      ctx.moveTo(0, i + Math.sin(t + i*0.01) * 20);
      ctx.lineTo(w, i + Math.cos(t + i*0.02) * 20);
    }
    ctx.stroke();
  }
  draw();
}
function initHeroThreeJS() {
  const container = document.getElementById('hero-3d');
  if (!container) return;
  const COUNT = 4000;
  const w = container.offsetWidth || 540;
  const h = container.offsetHeight || 540;
  const dpr = Math.min(window.devicePixelRatio, 2);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(dpr);
  renderer.setSize(w, h);
  renderer.setClearColor(0x000000, 0);
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  const baseZ = 5.8;
  camera.position.z = baseZ;

  const positions = new Float32Array(COUNT * 3);
  const randoms = new Float32Array(COUNT);
  const phaseArr = new Float32Array(COUNT);
  const explodeDirs = new Float32Array(COUNT * 3);
  const explodeSpeeds = new Float32Array(COUNT);

  for (let i = 0; i < COUNT; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random() * 2 - 1);
    const r = 1.4;
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);
    randoms[i] = Math.random();
    phaseArr[i] = Math.random() * Math.PI * 2;
    const et = Math.random() * Math.PI * 2;
    const ep = Math.acos(Math.random() * 2 - 1);
    explodeDirs[i * 3]     = Math.sin(ep) * Math.cos(et);
    explodeDirs[i * 3 + 1] = Math.sin(ep) * Math.sin(et);
    explodeDirs[i * 3 + 2] = Math.cos(ep);
    explodeSpeeds[i] = 0.55 + Math.random() * 0.9;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aRandom', new THREE.BufferAttribute(randoms, 1));
  geo.setAttribute('aPhase', new THREE.BufferAttribute(phaseArr, 1));
  geo.setAttribute('aExplodeDir', new THREE.BufferAttribute(explodeDirs, 3));
  geo.setAttribute('aExplodeSpeed', new THREE.BufferAttribute(explodeSpeeds, 1));

  const vertexShader = `
    uniform float uTime;
    uniform float uPixelRatio;
    uniform vec3 uMouse;
    uniform float uHover;
    uniform float uExplodePhase;
    attribute float aRandom;
    attribute float aPhase;
    attribute vec3 aExplodeDir;
    attribute float aExplodeSpeed;
    varying float vEdge;
    varying float vDepth;
    varying float vNoise;

    vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 permute(vec4 x) { return mod289(((x * 34.0) + 10.0) * x); }
    vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

    float snoise(vec3 v) {
      const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
      const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
      vec3 i = floor(v + dot(v, C.yyy));
      vec3 x0 = v - i + dot(i, C.xxx);
      vec3 g = step(x0.yzx, x0.xyz);
      vec3 l = 1.0 - g;
      vec3 i1 = min(g.xyz, l.zxy);
      vec3 i2 = max(g.xyz, l.zxy);
      vec3 x1 = x0 - i1 + C.xxx;
      vec3 x2 = x0 - i2 + C.yyy;
      vec3 x3 = x0 - D.yyy;
      i = mod289(i);
      vec4 p = permute(permute(permute(
        i.z + vec4(0.0, i1.z, i2.z, 1.0))
        + i.y + vec4(0.0, i1.y, i2.y, 1.0))
        + i.x + vec4(0.0, i1.x, i2.x, 1.0));
      float n_ = 0.142857142857;
      vec3 ns = n_ * D.wyz - D.xzx;
      vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
      vec4 x_ = floor(j * ns.z);
      vec4 y_ = floor(j - 7.0 * x_);
      vec4 x = x_ * ns.x + ns.yyyy;
      vec4 y = y_ * ns.x + ns.yyyy;
      vec4 h = 1.0 - abs(x) - abs(y);
      vec4 b0 = vec4(x.xy, y.xy);
      vec4 b1 = vec4(x.zw, y.zw);
      vec4 s0 = floor(b0) * 2.0 + 1.0;
      vec4 s1 = floor(b1) * 2.0 + 1.0;
      vec4 sh = -step(h, vec4(0.0));
      vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
      vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
      vec3 p0 = vec3(a0.xy, h.x);
      vec3 p1 = vec3(a0.zw, h.y);
      vec3 p2 = vec3(a1.xy, h.z);
      vec3 p3 = vec3(a1.zw, h.w);
      vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
      p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
      vec4 m = max(0.5 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
      m = m * m;
      return 105.0 * dot(m * m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
    }

    void main() {
      vec3 pos = position;
      vec3 dir = normalize(pos);

      float n1 = snoise(pos * 1.5 + uTime * 0.4) * 0.35;
      float n2 = snoise(pos * 3.0 - uTime * 0.6) * 0.15;
      float n3 = snoise(pos * 6.0 + uTime * 1.0) * 0.05;
      float noise = n1 + n2 + n3;

      float breath = sin(uTime * 1.2 + aPhase) * 0.08;

      vec3 toMouse = uMouse - pos;
      float mouseDist = length(toMouse);
      float mouseInfluence = smoothstep(2.5, 0.0, mouseDist) * uHover;
      float ripple = sin(mouseDist * 5.0 - uTime * 3.0) * 0.15 * mouseInfluence;

      float displacement = noise + breath + ripple;
      pos += dir * displacement;
      float burst = sin(clamp(uExplodePhase, 0.0, 1.0) * 3.14159265);
      pos += aExplodeDir * (aExplodeSpeed * burst * 6.5);

      vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
      gl_Position = projectionMatrix * mvPos;

      float depth = -mvPos.z;
      float sizePulse = 1.0 + sin(aPhase + uTime * 2.5) * 0.2;
      gl_PointSize = (4.0 + aRandom * 3.0) * uPixelRatio * sizePulse * (4.0 / max(depth, 0.5));
      gl_PointSize *= (1.0 + burst * 0.55);

      vEdge = 1.0 - abs(dot(dir, vec3(0.0, 0.0, 1.0)));
      vDepth = clamp(depth * 0.15, 0.0, 1.0);
      vNoise = noise;
    }
  `;

  const fragmentShader = `
    varying float vEdge;
    varying float vDepth;
    varying float vNoise;

    void main() {
      float dist = length(gl_PointCoord - vec2(0.5));
      if (dist > 0.5) discard;
      float alpha = 1.0 - smoothstep(0.0, 0.5, dist);

      vec3 coreColor = vec3(0.04, 0.04, 0.06);
      vec3 limeGlow = vec3(0.78, 1.0, 0.0);

      float edgePow = pow(vEdge, 2.5);
      vec3 color = mix(coreColor, limeGlow, edgePow * 0.7);
      color += limeGlow * edgePow * 0.4;

      alpha *= 0.92;

      gl_FragColor = vec4(color, alpha);
    }
  `;

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: dpr },
      uMouse: { value: new THREE.Vector3(0, 0, 0) },
      uHover: { value: 0 },
      uExplodePhase: { value: 0 }
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false
  });

  const points = new THREE.Points(geo, mat);
  scene.add(points);

  let mouseX = 0, mouseY = 0, hover = 0;
  container.addEventListener('mousemove', (e) => {
    if (window.innerWidth <= 960) return;
    const rect = container.getBoundingClientRect();
    mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouseY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    hover = 1;
  });
  container.addEventListener('mouseleave', () => { hover = 0; });

  // Mobile interaction removed as requested

  const targetMouse = new THREE.Vector3();
  let smoothHover = 0;

  points.scale.set(0, 0, 0);
  gsap.to(points.scale, { x: 1, y: 1, z: 1, duration: 1.6, ease: 'elastic.out(1, 0.5)', delay: 0.2 });

  let autoY = 0;
  (function animate() {
    requestAnimationFrame(animate);
    mat.uniforms.uTime.value += 0.008;
    autoY += 0.003;

    targetMouse.x += (mouseX * 2 - targetMouse.x) * 0.06;
    targetMouse.y += (mouseY * 2 - targetMouse.y) * 0.06;
    smoothHover += (hover - smoothHover) * 0.05;

    mat.uniforms.uMouse.value.copy(targetMouse);
    mat.uniforms.uHover.value = smoothHover;

    points.rotation.y = autoY + targetMouse.x * 0.15;
    points.rotation.x = targetMouse.y * 0.1;

    renderer.render(scene, camera);
  })();

  window.addEventListener('resize', () => {
    const nw = container.offsetWidth || 540;
    const nh = nw;
    camera.aspect = 1;
    camera.position.z = baseZ;
    camera.updateProjectionMatrix();
    renderer.setSize(nw, nh);
  });
}
function initAboutThreeJS() {
  const canvas = document.getElementById('about-canvas');
  if (!canvas) return;
  const w = 280, h = 280;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, canvas });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(w, h);
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  camera.position.z = 4;
  const mat1 = new THREE.MeshPhongMaterial({ color: 0xE0E0E0, specular: 0xFFFFFF, shininess: 150, emissive: 0x0A0A0A });
  const mat2 = new THREE.MeshPhongMaterial({ color: 0xAAAAAA, specular: 0xEEEEEE, shininess: 80, emissive: 0x050505 });
  const c1 = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.8, -1.4, 0.2),
    new THREE.Vector3(-0.3, 0, 0.6),
    new THREE.Vector3(0.4, 0.6, -0.4),
    new THREE.Vector3(0.8, 1.4, 0)
  ]);
  const c2 = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.8, -1.4, -0.2),
    new THREE.Vector3(0.3, 0, -0.6),
    new THREE.Vector3(-0.4, 0.6, 0.4),
    new THREE.Vector3(-0.8, 1.4, 0)
  ]);
  scene.add(new THREE.Mesh(new THREE.TubeGeometry(c1, 64, 0.07, 8, false), mat1));
  scene.add(new THREE.Mesh(new THREE.TubeGeometry(c2, 64, 0.07, 8, false), mat2));
  scene.add(new THREE.AmbientLight(0xFFFFFF, 0.6));
  const dl = new THREE.DirectionalLight(0xFFFFFF, 2);
  dl.position.set(2, 3, 2);
  scene.add(dl);
  (function animate() {
    requestAnimationFrame(animate);
    scene.rotation.y += 0.007;
    scene.rotation.x += 0.003;
    renderer.render(scene, camera);
  })();
}
function initStackThreeJS() {
  const canvas = document.getElementById('stack-canvas');
  if (!canvas) return;
  const w = 360, h = 360;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, canvas });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(w, h);
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.z = 5;
  const geo = new THREE.BoxGeometry(2.2, 2.2, 2.2);
  const cubeMat = new THREE.MeshPhongMaterial({
    color: 0x141414,
    specular: 0x555555,
    shininess: 60,
    emissive: 0x080808,
    emissiveIntensity: 0.6,
    transparent: true,
    opacity: 0.95
  });
  const cube = new THREE.Mesh(geo, cubeMat);
  scene.add(cube);
  const edges = new THREE.EdgesGeometry(geo);
  const lineMat = new THREE.LineBasicMaterial({ color: 0xC8FF00, linewidth: 2 });
  cube.add(new THREE.LineSegments(edges, lineMat));
  scene.add(new THREE.AmbientLight(0xFFFFFF, 0.25));
  const dl = new THREE.DirectionalLight(0xC8FF00, 0.8);
  dl.position.set(3, 4, 3);
  scene.add(dl);
  const dl2 = new THREE.DirectionalLight(0xAABBFF, 0.5);
  dl2.position.set(-4, -2, 2);
  scene.add(dl2);
  const pt = new THREE.PointLight(0xC8FF00, 0.4, 12);
  pt.position.set(0, 3, 3);
  scene.add(pt);
  cube.scale.set(0, 0, 0);
  ScrollTrigger.create({
    trigger: '#stack',
    start: 'top 80%',
    once: true,
    onEnter: () => {
      gsap.to(cube.scale, { x: 1, y: 1, z: 1, duration: 1.2, ease: 'elastic.out(1, 0.55)' });
    }
  });
  let mouseParX = 0, mouseParY = 0;
  document.addEventListener('mousemove', (e) => {
    mouseParX = ((e.clientX / window.innerWidth) - 0.5) * 0.4;
    mouseParY = ((e.clientY / window.innerHeight) - 0.5) * 0.4;
  });
  let rotX = 0, rotY = 0;
  (function animate() {
    requestAnimationFrame(animate);
    rotX += 0.005;
    rotY += 0.008;
    cube.rotation.x = rotX + mouseParY;
    cube.rotation.y = rotY + mouseParX;
    renderer.render(scene, camera);
  })();
  const ringEl = document.querySelector('.stack-cube-ring-text');
  if (ringEl) {
    ringEl.innerHTML = ringEl.textContent + ringEl.textContent;
  }
}
const CARD_CONFIGS = [
  { type: 'icosahedron', color: 0xC4C4C4, specular: 0xFFFFFF, shininess: 200 },
  { type: 'tube', color: 0xBBBBBB, specular: 0xFFFFFF, shininess: 150 },
  { type: 'grid', color: 0xCCCCCC, specular: 0xFFFFFF, shininess: 120 },
  { type: 'torus', color: 0xC9921A, specular: 0xFFD700, shininess: 180 }
];
function initCardThreeJS() {
  CARD_CONFIGS.forEach((cfg, i) => {
    const canvas = document.getElementById(`card-canvas-${i}`);
    if (!canvas) return;
    const w = canvas.parentElement ? Math.min(canvas.parentElement.offsetWidth, 400) : 356;
    const h = 200;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, canvas });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h);
    renderer.setClearColor(0xF5F5F5, 1);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xF5F5F5);
    const camera = new THREE.PerspectiveCamera(40, w / h, 0.1, 100);
    camera.position.z = 3.8;
    const mat = new THREE.MeshPhongMaterial({
      color: cfg.color,
      specular: cfg.specular,
      shininess: cfg.shininess,
      emissive: 0x111111,
      emissiveIntensity: 0.1
    });
    let mesh;
    if (cfg.type === 'icosahedron') {
      mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(0.85, 1), mat);
    } else if (cfg.type === 'tube') {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-1.1, 0, 0),
        new THREE.Vector3(-0.4, 0.6, 0.4),
        new THREE.Vector3(0, -0.4, 0),
        new THREE.Vector3(0.4, 0.6, -0.4),
        new THREE.Vector3(1.1, 0, 0)
      ]);
      mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 64, 0.14, 8, false), mat);
    } else if (cfg.type === 'grid') {
      const planeGeo = new THREE.PlaneGeometry(1.8, 1.8, 10, 10);
      const wireMat = new THREE.MeshPhongMaterial({ color: 0xBBBBBB, wireframe: true, emissive: 0x111111 });
      mesh = new THREE.Mesh(planeGeo, wireMat);
      mesh.rotation.x = -0.4;
    } else {
      mesh = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.24, 32, 64), mat);
    }
    scene.add(mesh);
    scene.add(new THREE.AmbientLight(0xFFFFFF, 0.7));
    const dl = new THREE.DirectionalLight(0xFFFFFF, 2.5);
    dl.position.set(3, 4, 3);
    scene.add(dl);
    const dl2 = new THREE.DirectionalLight(0xAABBFF, 0.8);
    dl2.position.set(-3, -2, 2);
    scene.add(dl2);
    (function animate() {
      requestAnimationFrame(animate);
      mesh.rotation.x += 0.005;
      mesh.rotation.y += 0.008;
      renderer.render(scene, camera);
    })();
  });
}

function initCompPageAnimations() {
  const isCompPage = document.querySelector('#comp-hero');
  if (!isCompPage) return;

  gsap.from('.comp-fade-in', {
    y: 30,
    opacity: 0,
    duration: 1,
    stagger: 0.2,
    ease: 'power3.out',
    delay: 0.4
  });

  gsap.utils.toArray('.comp-slide-up').forEach((el) => {
    gsap.from(el, {
      y: 40,
      opacity: 0,
      duration: 0.8,
      ease: 'expo.out',
      scrollTrigger: { trigger: el, start: 'top 85%', once: true }
    });
  });

  initCompHeroCanvas();
}

function initCompHeroCanvas() {
  const canvas = document.getElementById('comp-hero-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let w, h, t = 0;
  function resize() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);
  
  function draw() {
    requestAnimationFrame(draw);
    t += 0.015;
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, w, h);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    
    ctx.beginPath();
    for (let i = 0; i < w; i += 60) {
      ctx.moveTo(i + Math.sin(t + i*0.01) * 30, 0);
      ctx.lineTo(i + Math.cos(t + i*0.02) * 30, h);
    }
    ctx.stroke();
  }
  draw();
}

function initContributePageAnimations() {
  const isContribPage = document.querySelector('#contrib-hero');
  if (!isContribPage) return;

  gsap.from('.contrib-fade-in', {
    y: 30,
    opacity: 0,
    duration: 1,
    stagger: 0.2,
    ease: 'power3.out',
    delay: 0.4
  });

  gsap.utils.toArray('.contrib-slide-up').forEach((el) => {
    gsap.from(el, {
      y: 40,
      opacity: 0,
      duration: 0.8,
      ease: 'expo.out',
      scrollTrigger: { trigger: el, start: 'top 85%', once: true }
    });
  });

  initContribHeroCanvas();
}

function initContribHeroCanvas() {
  const canvas = document.getElementById('contrib-hero-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let w, h, t = 0;
  function resize() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);
  
  function draw() {
    requestAnimationFrame(draw);
    t += 0.012;
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, w, h);
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(200, 255, 0, 0.08)';
    
    ctx.beginPath();
    for (let i = 0; i < h; i += 40) {
      ctx.moveTo(0, i + Math.sin(t + i*0.01) * 20);
      ctx.lineTo(w, i + Math.cos(t + i*0.02) * 20);
    }
    ctx.stroke();
  }
  draw();
}

function initSponsorsPageAnimations() {
  const isSponsorsPage = document.querySelector('#sponsors-hero');
  if (!isSponsorsPage) return;

  gsap.from('.sponsors-fade-in', {
    y: 30,
    opacity: 0,
    duration: 1,
    stagger: 0.2,
    ease: 'power3.out',
    delay: 0.4
  });

  gsap.utils.toArray('.sponsors-slide-up').forEach((el) => {
    gsap.from(el, {
      y: 40,
      opacity: 0,
      duration: 0.8,
      ease: 'expo.out',
      scrollTrigger: { trigger: el, start: 'top 85%', once: true }
    });
  });

  initSponsorsHeroCanvas();
}

function initSponsorsHeroCanvas() {
  if (document.getElementById('sponsors-hero-canvas')) initSponsorsHero();
  loadSponsorsFromCMS();
  loadReposFromCMS();
  loadCompetitionsFromCMS();
}

async function loadSponsorsFromCMS() {
  const grid = document.getElementById('cms-sponsors-grid');
  if (!grid) return;

  try {
    const sponsors = await sanityClient.fetch(`*[_type == "sponsor"] | order(tier asc)`);
    
    if (sponsors.length === 0) {
      grid.innerHTML = `
        <div class="sponsors-empty-state sponsors-slide-up">
          <h3>No Sponsors Yet</h3>
          <p>Be the first to support our community!</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = '';
    sponsors.forEach(sponsor => {
      const imgUrl = sponsor.logo ? urlFor(sponsor.logo).width(400).url() : '';
      grid.innerHTML += `
        <a href="${sponsor.url || '#'}" target="_blank" class="sponsor-card sponsors-slide-up ${sponsor.tier || 'community'}">
          <div class="sponsor-logo-container">
            ${imgUrl ? `<img src="${imgUrl}" alt="${sponsor.name} logo" class="sponsor-logo">` : `<span style="color:var(--black)">${sponsor.name}</span>`}
          </div>
          <div class="sponsor-overlay">
            <span class="sponsor-name">${sponsor.name}</span>
            <span class="sponsor-tier">${sponsor.tier || 'Community'} Partner</span>
          </div>
        </a>
      `;
    });
    
    ScrollTrigger.refresh();
  } catch (error) {
    console.error("Failed to load sponsors from Sanity CMS", error);
    grid.innerHTML = `<div class="sponsors-empty-state"><h3>Error loading sponsors</h3></div>`;
  }
}

async function loadCompetitionsFromCMS() {
  const grid = document.getElementById('cms-competitions-grid');
  if (!grid) return;

  try {
    const competitions = await sanityClient.fetch(`*[_type == "competition"] | order(_createdAt desc)`);
    
    if (competitions.length === 0) {
      grid.innerHTML = `
        <div class="comp-empty-state comp-slide-up">
          <h3>No Active Competitions</h3>
          <p>Check back later for upcoming hackathons.</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = '';
    competitions.forEach(comp => {
      const imgUrl = comp.coverImage ? urlFor(comp.coverImage).width(600).url() : '';
      
      const card = document.createElement('div');
      card.className = 'comp-card comp-slide-up';
      card.style.cursor = 'pointer';
      
      card.innerHTML = `
        ${imgUrl ? `<img src="${imgUrl}" alt="${comp.title}" style="width: 100%; height: 200px; object-fit: cover; border-radius: 12px 12px 0 0;">` : ''}
        <div style="padding: 24px;">
          <h3 style="font-family: 'Clash Display', sans-serif; font-size: 20px; color: var(--white); margin-bottom: 12px;">${comp.title}</h3>
          <p style="color: var(--slate); font-size: 15px; margin-bottom: 16px; line-height: 1.5;">${comp.shortDescription}</p>
          <span class="btn-pill" style="display: inline-block;">View Details →</span>
        </div>
      `;

      card.addEventListener('click', () => openCompetitionModal(comp));
      grid.appendChild(card);
    });
    
    ScrollTrigger.refresh();
  } catch (error) {
    console.error("Failed to load competitions from Sanity CMS", error);
    grid.innerHTML = `<div class="comp-empty-state"><h3>Error loading competitions</h3></div>`;
  }
}

function openCompetitionModal(comp) {
  const overlay = document.getElementById('competition-modal-overlay');
  if (!overlay) return;

  const img = document.getElementById('comp-modal-image');
  if (comp.coverImage) {
    img.src = urlFor(comp.coverImage).width(800).url();
    img.style.display = 'block';
  } else {
    img.style.display = 'none';
  }

  document.getElementById('comp-modal-title').textContent = comp.title || 'Competition';
  document.getElementById('comp-modal-desc').textContent = comp.shortDescription || '';

  // Timeline
  const timelineContainer = document.getElementById('comp-modal-timeline');
  timelineContainer.innerHTML = '';
  if (comp.timeline && comp.timeline.length > 0) {
    comp.timeline.forEach((stage, index) => {
      const isActive = index === (comp.currentStageIndex || 0);
      timelineContainer.innerHTML += `
        <div style="margin-bottom: 16px; padding: 12px; border-left: 4px solid ${isActive ? 'var(--lime)' : 'var(--border)'}; background: ${isActive ? 'rgba(200, 255, 0, 0.05)' : 'transparent'};">
          <strong style="color: ${isActive ? 'var(--lime)' : 'var(--white)'}">${stage.stageName}</strong>
          <div style="color: var(--slate); font-size: 12px; margin-bottom: 4px;">${stage.date || ''}</div>
          <div style="color: var(--ghost); font-size: 14px;">${stage.description || ''}</div>
        </div>
      `;
    });
  } else {
    timelineContainer.innerHTML = '<p style="color: var(--slate); font-size: 14px;">Timeline not announced yet.</p>';
  }

  // Notices
  const noticesContainer = document.getElementById('comp-modal-notices');
  noticesContainer.innerHTML = '';
  if (comp.notices && comp.notices.length > 0) {
    comp.notices.forEach(notice => {
      noticesContainer.innerHTML += `<li style="margin-bottom: 8px;">${notice}</li>`;
    });
  } else {
    noticesContainer.innerHTML = '<li style="color: var(--ghost);">No notices at this time.</li>';
  }

  // Links
  const linksContainer = document.getElementById('comp-modal-links');
  linksContainer.innerHTML = '';
  if (comp.links && comp.links.length > 0) {
    comp.links.forEach(link => {
      linksContainer.innerHTML += `<a href="${link.url}" target="_blank" class="btn-pill" style="border: 1px dashed var(--border); background: transparent;">${link.label} ↗</a>`;
    });
  }

  // Register logic
  const regBtn = document.getElementById('comp-btn-register');
  regBtn.onclick = () => {
    // Check auth
    import('./firebase.js').then(({ auth }) => {
      if (auth.currentUser) {
        // Go to dashboard competitions tab
        window.location.href = `/dashboard.html?tab=hackathons&comp=${comp._id}`;
      } else {
        // Not logged in
        alert("Please login first to register for this hackathon.");
        overlay.classList.remove('active');
        // Optionally scroll to top or trigger login modal if exists
        window.scrollTo(0, 0);
      }
    });
  };

  overlay.classList.add('active');
}

// Close competition modal
const compModalCloseBtn = document.getElementById('competition-modal-close');
if (compModalCloseBtn) {
  compModalCloseBtn.addEventListener('click', () => {
    document.getElementById('competition-modal-overlay').classList.remove('active');
  });
}

async function loadReposFromCMS() {
  const grid = document.getElementById('cms-contrib-grid');
  if (!grid) return;

  try {
    const repos = await sanityClient.fetch(`*[_type == "repository"] | order(_createdAt desc)`);
    
    if (repos.length === 0) {
      grid.innerHTML = `
        <div class="contrib-empty-state contrib-slide-up">
          <h3>No Repositories Yet</h3>
          <p>Check back later for open-source projects.</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = '';
    repos.forEach(repo => {
      const tagsHtml = (repo.tags || []).map(tag => `<span class="repo-tag">${tag}</span>`).join('');
      grid.innerHTML += `
        <div class="repo-card contrib-slide-up">
          <h3>${repo.title}</h3>
          <p>${repo.description}</p>
          <div class="repo-tags">${tagsHtml}</div>
          <a href="${repo.githubUrl}" target="_blank" class="btn-pill" style="margin-top: 16px; display: inline-block;">View Repository →</a>
        </div>
      `;
    });
    
    ScrollTrigger.refresh();
  } catch (error) {
    console.error("Failed to load repositories from Sanity CMS", error);
    grid.innerHTML = `<div class="contrib-empty-state"><h3>Error loading repositories</h3></div>`;
  }
}

function initSponsorsHero() {
  const canvas = document.getElementById('sponsors-hero-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let w, h, t = 0;
  function resize() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);
  
  function draw() {
    requestAnimationFrame(draw);
    t += 0.015;
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, w, h);
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    
    ctx.beginPath();
    for (let i = 0; i < w; i += 50) {
      ctx.moveTo(i, h);
      ctx.quadraticCurveTo(i + Math.sin(t + i*0.01) * 100, h/2, i + Math.cos(t + i*0.02) * 50, 0);
    }
    ctx.stroke();
  }
  draw();
}

initHeroDisplacement();

if (sessionStorage.getItem('siteLoaded')) {
  const preloader = document.getElementById('preloader');
  if (preloader) preloader.style.display = 'none';
  initSite();
} else {
  initPreloader();
  sessionStorage.setItem('siteLoaded', 'true');
}

window.addEventListener('load', () => {
  initHeroThreeJS();
  initAboutThreeJS();
  initStackThreeJS();
  initStats();
  initFeatures();
});


function initStats() {
  const cells = document.querySelectorAll('.stat-cell');
  if (!cells.length) return;

  gsap.fromTo(cells,
    { opacity: 0, y: 28 },
    {
      opacity: 1,
      y: 0,
      duration: 0.7,
      ease: 'power2.out',
      stagger: 0.15,
      scrollTrigger: {
        trigger: '#stats',
        start: 'top 80%',
        once: true
      }
    }
  );

  const targets = document.querySelectorAll('[data-target]');
  targets.forEach(el => {
    const raw = el.getAttribute('data-target');
    const end = parseFloat(raw);
    if (isNaN(end)) return;

    const counter = { val: 0 };

    gsap.fromTo(counter,
      { val: 0 },
      {
        val: end,
        duration: end === 0 ? 0.01 : 1.4,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: '#stats',
          start: 'top 80%',
          once: true
        },
        onUpdate() {
          el.textContent = Math.round(counter.val);
        }
      }
    );
  });
}

function initFeatures() {
  const cards = document.querySelectorAll('.feature-card');
  if (!cards.length) return;

  cards.forEach((card) => {
    const isReverse = card.classList.contains('reverse');
    const startX = isReverse ? 100 : -100;

    gsap.fromTo(card,
      { opacity: 0, x: startX, autoAlpha: 0 },
      {
        opacity: 1,
        x: 0,
        autoAlpha: 1,
        duration: 1,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: card,
          start: 'top 85%',
          once: true
        }
      }
    );
  });
}

// Profile Modal Logic
window.openProfileModal = function (platform) {
  const overlay = document.getElementById('profile-modal-overlay');
  const title = document.getElementById('modal-platform-name');
  const aditya = document.getElementById('modal-link-aditya');
  const manika = document.getElementById('modal-link-manika');

  if (platform === 'GitHub') {
    title.textContent = 'GitHub';
    manika.href = 'https://github.com/ManikaKutiyal';
    aditya.href = 'https://github.com/adityaverma9777';

  } else {
    title.textContent = 'LinkedIn';
    manika.href = 'https://www.linkedin.com/in/manika-kutiyal/';
    aditya.href = 'https://www.linkedin.com/in/adityaverma9777/';
  }

  overlay.classList.add('active');
};

document.getElementById('profile-modal-close').addEventListener('click', () => {
  document.getElementById('profile-modal-overlay').classList.remove('active');
});

document.getElementById('profile-modal-overlay').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) {
    e.currentTarget.classList.remove('active');
  }
});

document.querySelectorAll('.modal-buttons .btn-pill').forEach(btn => {
  btn.addEventListener('click', () => {
    document.getElementById('profile-modal-overlay').classList.remove('active');
  });
});

window.loadHomepageSponsors = async function() {
  const wrap = document.getElementById('home-sponsors-timeline-wrap');
  const entries = document.getElementById('hack-entries');
  if (!wrap || !entries) return;

  try {
    const sponsors = await sanityClient.fetch(`*[_type == "sponsor"] | order(tier asc)`);
    
    if (!sponsors || sponsors.length === 0) {
      wrap.style.display = 'none'; // hide if empty
      return;
    }
    
    wrap.style.display = 'flex';
    entries.innerHTML = '';
    
    sponsors.forEach((sponsor, index) => {
      entries.innerHTML += `
        <div class="hack-entry" data-place="${index + 1}">
          <div class="hack-stem"></div>
          <div class="hack-card">
            <div class="hack-card-name">${sponsor.name}</div>
          </div>
        </div>
      `;
    });
    
    // Initialize ScrollTrigger for newly added entries
    const watermark = document.getElementById('hack-watermark');
    entries.querySelectorAll('.hack-entry').forEach((entry, i) => {
      const stem = entry.querySelector('.hack-stem');
      const card = entry.querySelector('.hack-card');
      ScrollTrigger.create({
        trigger: entry,
        start: 'top 82%',
        once: true,
        onEnter: () => {
          gsap.to(stem, { scaleY: 1, duration: 0.55, ease: 'expo.out' });
          gsap.to(card, { opacity: 1, y: 0, duration: 0.45, ease: 'expo.out', delay: 0.45 });
          if (watermark) {
            gsap.to(watermark, {
              textContent: i + 1,
              duration: 0.01,
              delay: 0.1,
              onUpdate: () => { watermark.textContent = i + 1; }
            });
          }
        }
      });
    });
    
    // Refresh ScrollTrigger to account for new elements
    setTimeout(() => {
      ScrollTrigger.refresh();
    }, 100);
  } catch (err) {
    console.error('Failed to load homepage sponsors', err);
    wrap.style.display = 'none';
  }
};

window.loadLeaderboard = async function() {
  const lbBody = document.getElementById('home-leaderboard-body');
  if (!lbBody) return;

  try {
    const { collection, query, orderBy, limit, getDocs } = await import('firebase/firestore');
    const { db } = await import('./firebase.js');
    
    const q = query(collection(db, 'users'), orderBy('points', 'desc'), limit(5));
    const snap = await getDocs(q);
    
    if (snap.empty) {
      lbBody.innerHTML = '<div class="lb-row"><div class="lb-col" style="width:100%;text-align:center;color:var(--slate);">No contributors yet.</div></div>';
      return;
    }
    
    lbBody.innerHTML = '';
    let rank = 1;
    snap.forEach(docSnap => {
      const data = docSnap.data();
      const roleStr = data.title || 'Contributor'; // Fallback if no title
      const points = data.points || 0;
      const name = data.name || 'Anonymous';
      
      let rankStr = `#${rank}`;
      let rankClass = ``;
      if (rank <= 3) {
        rankStr = `<span class="neon-rank">#${rank}</span>`;
        rankClass = `rank-${rank}`;
      }
      
      lbBody.innerHTML += `
        <div class="lb-row ${rankClass}">
          <div class="lb-col lb-rank commit-mono">${rankStr}</div>
          <div class="lb-col lb-user">
            <div class="lb-avatar" style="background-image: url('${data.photoURL || ''}')"></div>
            <span class="lb-name">${name}</span>
          </div>
          <div class="lb-col lb-role">${roleStr}</div>
          <div class="lb-col lb-points commit-mono">${points}</div>
        </div>
      `;
      rank++;
    });
    
    setTimeout(() => {
      ScrollTrigger.refresh();
    }, 100);
  } catch (error) {
    console.error('Failed to load leaderboard', error);
    lbBody.innerHTML = '<div class="lb-row"><div class="lb-col" style="width:100%;text-align:center;color:#ef4444;">Error loading leaderboard.</div></div>';
  }
};
