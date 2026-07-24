import { supabase } from './supabase.js';
document.addEventListener('DOMContentLoaded', async () => {
  const pathParts = window.location.pathname.split('/').filter(Boolean);
  const uniqueId = pathParts[pathParts.length - 1];
  const loader = document.getElementById('loader');
  const content = document.getElementById('content');
  const errorScreen = document.getElementById('error-screen');
  if (!uniqueId || !supabase) {
    loader.style.display = 'none';
    errorScreen.style.display = 'block';
    return;
  }
  try {
    const { data, error } = await supabase
      .from('id_cards')
      .select('*')
      .eq('unique_id', uniqueId)
      .single();
    if (error || !data || data.status === 'revoked') {
      throw new Error("ID Card not found or revoked");
    }
    document.getElementById('det-name').textContent = data.name;
    document.getElementById('det-role').textContent = data.role;
    document.getElementById('det-age').textContent = data.age;
    document.getElementById('det-location').textContent = `${data.city}, ${data.state}`;
    document.getElementById('det-college').textContent = data.college;
    document.getElementById('det-joining').textContent = data.joining_date;
    document.getElementById('det-valid').textContent = data.valid_till;
    const statusEl = document.getElementById('det-status');
    statusEl.textContent = data.status;
    if (data.status === 'active') {
      statusEl.style.background = 'rgba(200, 255, 0, 0.12)';
      statusEl.style.color = '#65a30d';
    } else {
      statusEl.style.background = 'rgba(239,68,68,0.1)';
      statusEl.style.color = '#ef4444';
    }
    document.getElementById('card-name').textContent = data.name;
    document.getElementById('card-role').textContent = data.role;
    document.getElementById('card-joining').textContent = data.joining_date;
    document.getElementById('card-valid').textContent = data.valid_till;
    document.getElementById('card-photo').src = data.profile_pic_url;
    document.getElementById('card-id-num').textContent = `ID-${data.unique_id}`;
    document.getElementById('card-university').textContent = data.college || '';
    const qrContainer = document.getElementById('qrcode');
    new QRCode(qrContainer, {
      text: window.location.href,
      width: 100,
      height: 100,
      colorDark: '#000000',
      colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.H
    });
    loader.style.display = 'none';
    content.style.display = 'block';
  } catch (err) {
    console.error(err);
    loader.style.display = 'none';
    errorScreen.style.display = 'block';
  }
  document.getElementById('btn-download').addEventListener('click', async () => {
    const S = 3;
    const W = 320 * S;
    const H_PAD = 28 * S;
    const cardEl = document.querySelector('.id-card');
    const cardH = cardEl.offsetHeight * S;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = cardH;
    const ctx = canvas.getContext('2d');
    const lime = '#C8FF00';
    const bg = '#050505';
    const white = '#ffffff';
    function roundRect(x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
    }
    roundRect(0, 0, W, cardH, 18 * S);
    ctx.clip();
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, cardH);
    ctx.fillStyle = lime;
    ctx.fillRect(0, 0, 4 * S, cardH);
    const brandName = document.getElementById('card-id-num')?.textContent || '';
    const cardName = document.getElementById('card-name')?.textContent || '';
    const cardRole = document.getElementById('card-role')?.textContent || '';
    const cardUni = document.getElementById('card-university')?.textContent || '';
    const cardJoining = document.getElementById('card-joining')?.textContent || '';
    const cardValid = document.getElementById('card-valid')?.textContent || '';
    const px = 24 * S;
    let cy = H_PAD;
    const logoImg = new Image();
    logoImg.crossOrigin = 'anonymous';
    logoImg.src = document.querySelector('.brand-icon')?.src || '/logo.png';
    const photoImg = new Image();
    photoImg.crossOrigin = 'anonymous';
    photoImg.src = document.getElementById('card-photo')?.src || '';
    const qrCanvas = document.querySelector('#qrcode canvas') || document.querySelector('#qrcode img');
    await Promise.all([
      new Promise(r => { if (logoImg.complete) r(); else logoImg.onload = r; logoImg.onerror = r; }),
      new Promise(r => { if (photoImg.complete) r(); else photoImg.onload = r; photoImg.onerror = r; }),
    ]);
    const logoS = 22 * S;
    ctx.drawImage(logoImg, px, cy, logoS, logoS);
    ctx.font = `800 ${(1.1 * 16 * S)}px Agile, Inter, sans-serif`;
    ctx.fillStyle = white;
    ctx.textBaseline = 'middle';
    ctx.fillText('MnM', px + logoS + 8 * S, cy + logoS / 2);
    ctx.font = `600 ${(0.7 * 16 * S)}px JetBrains Mono, monospace`;
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.textAlign = 'right';
    ctx.fillText(brandName, W - px, cy + logoS / 2);
    ctx.textAlign = 'left';
    cy += logoS + 20 * S;
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1 * S;
    ctx.beginPath();
    ctx.moveTo(px, cy);
    ctx.lineTo(W - px, cy);
    ctx.stroke();
    cy += 20 * S;
    const avatarSize = 110 * S;
    const avatarX = (W - avatarSize) / 2;
    const avatarCenterX = W / 2;
    const avatarCenterY = cy + avatarSize / 2;
    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarCenterX, avatarCenterY, avatarSize / 2 + 3 * S, 0, Math.PI * 2);
    ctx.strokeStyle = lime;
    ctx.lineWidth = 3 * S;
    ctx.stroke();
    ctx.restore();
    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarCenterX, avatarCenterY, avatarSize / 2 - 1 * S, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(photoImg, avatarX, cy, avatarSize, avatarSize);
    ctx.restore();
    cy += avatarSize + 24 * S;
    ctx.font = `800 ${(1.4 * 16 * S)}px Agile, Inter, sans-serif`;
    ctx.fillStyle = white;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(cardName, W / 2, cy);
    cy += 1.4 * 16 * S + 6 * S;
    ctx.font = `700 ${(0.75 * 16 * S)}px Inter, sans-serif`;
    ctx.fillStyle = lime;
    ctx.letterSpacing = '3px';
    ctx.fillText(cardRole.toUpperCase(), W / 2, cy);
    cy += 0.75 * 16 * S + 8 * S;
    if (cardUni) {
      ctx.font = `500 ${(0.7 * 16 * S)}px Inter, sans-serif`;
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillText(cardUni, W / 2, cy);
      cy += 0.7 * 16 * S + 8 * S;
    }
    cy += 12 * S;
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1 * S;
    ctx.beginPath();
    ctx.moveTo(px, cy);
    ctx.lineTo(W - px, cy);
    ctx.stroke();
    cy += 20 * S;
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.beginPath();
    ctx.moveTo(px, cy);
    ctx.lineTo(W - px, cy);
    ctx.stroke();
    cy += 16 * S;
    ctx.textAlign = 'left';
    ctx.font = `700 ${(0.6 * 16 * S)}px Inter, sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText('JOINED', px, cy);
    ctx.textAlign = 'right';
    ctx.fillText('EXPIRES', W - px, cy);
    cy += 0.6 * 16 * S + 6 * S;
    ctx.font = `600 ${(0.8 * 16 * S)}px JetBrains Mono, monospace`;
    ctx.fillStyle = white;
    ctx.textAlign = 'left';
    ctx.fillText(cardJoining, px, cy);
    ctx.textAlign = 'right';
    ctx.fillText(cardValid, W - px, cy);
    cy += 0.8 * 16 * S + 20 * S;
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.beginPath();
    ctx.moveTo(px, cy);
    ctx.lineTo(W - px, cy);
    ctx.stroke();
    cy += 16 * S;
    const qrSize = 50 * S;
    const qrPad = 5 * S;
    roundRect(px, cy, qrSize + qrPad * 2, qrSize + qrPad * 2, 6 * S);
    ctx.fillStyle = white;
    ctx.fill();
    if (qrCanvas) {
      ctx.drawImage(qrCanvas, px + qrPad, cy + qrPad, qrSize, qrSize);
    }
    const qrTextX = px + qrSize + qrPad * 2 + 14 * S;
    ctx.textAlign = 'left';
    ctx.font = `700 ${(0.55 * 16 * S)}px Inter, sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.fillText('VERIFY AUTHENTICITY', qrTextX, cy + 16 * S);
    ctx.font = `700 ${(0.8 * 16 * S)}px Inter, sans-serif`;
    ctx.fillStyle = lime;
    ctx.fillText('mnm.works', qrTextX, cy + 16 * S + 0.55 * 16 * S + 8 * S);
    const link = document.createElement('a');
    link.download = `MnM_ID_${uniqueId}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  });
  document.getElementById('btn-share').addEventListener('click', async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'MnM — Digital ID',
          text: 'Check out my MnM digital ID card!',
          url: url
        });
      } catch (err) {
        console.error('Share failed', err);
      }
    } else {
      navigator.clipboard.writeText(url).then(() => {
        const btn = document.getElementById('btn-share');
        const original = btn.textContent;
        btn.textContent = 'Copied!';
        setTimeout(() => { btn.textContent = original; }, 2000);
      });
    }
  });
});
