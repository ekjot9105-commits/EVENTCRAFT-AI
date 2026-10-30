/**
 * Pure canvas drawing routines for the landing-page hero. Kept separate from the
 * React component so the animation loop only owns state, timing, and lifecycle.
 */

export interface ConfettiPiece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  life: number;
  maxLife: number;
  size: number;
}

/** Shimmering gold geometric ring (weddings). */
export function drawRing(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, rotation: number, time: number): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotation);

  // Outer ring glow
  const gradient = ctx.createRadialGradient(0, 0, size * 0.6, 0, 0, size * 1.2);
  gradient.addColorStop(0, 'rgba(255, 215, 0, 0.08)');
  gradient.addColorStop(1, 'rgba(255, 215, 0, 0)');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(0, 0, size * 1.2, 0, Math.PI * 2);
  ctx.fill();

  // Diamond shape (geometric ring / gem)
  const shimmer = 0.7 + Math.sin(time * 2) * 0.3;
  ctx.strokeStyle = `rgba(255, 215, 0, ${shimmer})`;
  ctx.lineWidth = 2.5;
  ctx.shadowColor = 'rgba(255, 215, 0, 0.6)';
  ctx.shadowBlur = 15;

  // Draw hexagonal ring
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI * 2 / 6) * i - Math.PI / 2;
    const px = Math.cos(angle) * size;
    const py = Math.sin(angle) * size;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.stroke();

  // Inner diamond sparkle
  ctx.strokeStyle = `rgba(255, 245, 200, ${0.5 + Math.sin(time * 3.5) * 0.3})`;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI * 2 / 6) * i + Math.PI / 6;
    const px = Math.cos(angle) * size * 0.55;
    const py = Math.sin(angle) * size * 0.55;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.stroke();

  ctx.shadowBlur = 0;
  ctx.restore();
}

/** Ribbon gift box that periodically sheds confetti (birthdays). */
export function drawGift(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, rotation: number, time: number, confetti: ConfettiPiece[]): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotation * 0.3);

  // Box body
  const halfSize = size * 0.7;
  ctx.fillStyle = `rgba(255, 100, 150, ${0.6 + Math.sin(time * 2) * 0.15})`;
  ctx.shadowColor = 'rgba(255, 100, 150, 0.4)';
  ctx.shadowBlur = 20;
  ctx.beginPath();
  ctx.roundRect(-halfSize, -halfSize * 0.5, halfSize * 2, halfSize * 1.3, 6);
  ctx.fill();

  // Lid
  ctx.fillStyle = `rgba(255, 130, 170, ${0.7 + Math.sin(time * 2.5) * 0.15})`;
  ctx.beginPath();
  ctx.roundRect(-halfSize - 3, -halfSize * 0.5 - 10, halfSize * 2 + 6, 14, 4);
  ctx.fill();

  // Ribbon vertical
  ctx.fillStyle = 'rgba(255, 215, 100, 0.7)';
  ctx.fillRect(-3, -halfSize * 0.5, 6, halfSize * 1.3);

  // Ribbon horizontal
  ctx.fillRect(-halfSize, halfSize * 0.1, halfSize * 2, 5);

  // Bow on top
  ctx.strokeStyle = 'rgba(255, 215, 100, 0.8)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(-10, -halfSize * 0.5 - 14, 12, 7, -0.3, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(10, -halfSize * 0.5 - 14, 12, 7, 0.3, 0, Math.PI * 2);
  ctx.stroke();

  ctx.shadowBlur = 0;
  ctx.restore();

  // Spawn confetti periodically
  if (Math.random() < 0.06) {
    confetti.push({
      x: cx + (Math.random() - 0.5) * size,
      y: cy - size * 0.5,
      vx: (Math.random() - 0.5) * 2,
      vy: -Math.random() * 1.5 - 0.5,
      color: ['#FF6B9D', '#FFD700', '#00D4AA', '#7B61FF', '#FF9F43'][Math.floor(Math.random() * 5)] as string,
      life: 0,
      maxLife: 80 + Math.random() * 40,
      size: Math.random() * 4 + 2,
    });
  }
}

/** Glowing festival lantern (community events). */
export function drawLantern(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, rotation: number, time: number): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotation * 0.2);

  // Lantern glow
  const gGlow = ctx.createRadialGradient(0, 0, size * 0.2, 0, 0, size * 1.4);
  gGlow.addColorStop(0, `rgba(80, 200, 160, ${0.15 + Math.sin(time * 1.5) * 0.05})`);
  gGlow.addColorStop(1, 'rgba(80, 200, 160, 0)');
  ctx.fillStyle = gGlow;
  ctx.beginPath();
  ctx.arc(0, 0, size * 1.4, 0, Math.PI * 2);
  ctx.fill();

  // Lantern body (octagon)
  ctx.fillStyle = `rgba(0, 180, 140, ${0.5 + Math.sin(time * 2) * 0.15})`;
  ctx.shadowColor = 'rgba(0, 220, 170, 0.5)';
  ctx.shadowBlur = 18;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const angle = (Math.PI * 2 / 8) * i - Math.PI / 8;
    const px = Math.cos(angle) * size * 0.7;
    const py = Math.sin(angle) * size * 0.7;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();

  // Inner light
  const innerGlow = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 0.4);
  innerGlow.addColorStop(0, `rgba(255, 255, 200, ${0.5 + Math.sin(time * 3) * 0.2})`);
  innerGlow.addColorStop(1, 'rgba(255, 255, 200, 0)');
  ctx.fillStyle = innerGlow;
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.4, 0, Math.PI * 2);
  ctx.fill();

  // Hanging string
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, -size * 0.7);
  ctx.lineTo(0, -size * 1.3);
  ctx.stroke();

  // Bottom tassel
  ctx.strokeStyle = 'rgba(0, 180, 140, 0.5)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, size * 0.7);
  ctx.lineTo(0, size * 1.1);
  ctx.stroke();

  ctx.shadowBlur = 0;
  ctx.restore();
}
