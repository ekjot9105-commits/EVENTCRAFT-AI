import { useEffect, useRef, useCallback } from 'react';
import { prefersReducedMotion } from '../utils/motion';
import { drawGift, drawLantern, drawRing, type ConfettiPiece } from './celebrationShapes';

interface CelebrationHeroCanvasProps {
  className?: string;
}

interface Particle {
  x: number;
  y: number;
  size: number;
  speedX: number;
  speedY: number;
  opacity: number;
  hue: number;
  phase: number;
}

interface FloatingObject {
  x: number;
  y: number;
  baseY: number;
  size: number;
  rotation: number;
  rotSpeed: number;
  bobPhase: number;
  bobSpeed: number;
  bobAmplitude: number;
  type: 'ring' | 'gift' | 'lantern';
  glow: string;
}

/**
 * Lightweight HTML5 canvas rendering floating celebration artifacts:
 * - 💍 Shimmering gold geometric ring (Weddings)
 * - 🎁 Animated floating ribbon gift box with confetti (Birthdays)
 * - 🎪 Vibrant community festival lantern (Community Events)
 *
 * Features cursor parallax (mousemove tilts scene), ambient lighting,
 * floating dust motes, and smooth 60fps animation.
 */
export default function CelebrationHeroCanvas({ className = '' }: CelebrationHeroCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: 0.5, y: 0.5 });
  const animFrameRef = useRef<number>(0);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    mouseRef.current = {
      x: e.clientX / window.innerWidth,
      y: e.clientY / window.innerHeight,
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = 0;
    let height = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);
    };
    resize();
    window.addEventListener('resize', resize);

    // Create dust mote particles
    const particles: Particle[] = [];
    for (let i = 0; i < 60; i++) {
      particles.push({
        x: Math.random() * 1200,
        y: Math.random() * 700,
        size: Math.random() * 2 + 0.5,
        speedX: (Math.random() - 0.5) * 0.3,
        speedY: (Math.random() - 0.5) * 0.2 - 0.1,
        opacity: Math.random() * 0.4 + 0.1,
        hue: Math.random() * 60 + 30,
        phase: Math.random() * Math.PI * 2,
      });
    }

    // Create floating celebration objects
    const objects: FloatingObject[] = [
      {
        x: 0.2, y: 0.4, baseY: 0.4, size: 45,
        rotation: 0, rotSpeed: 0.008, bobPhase: 0, bobSpeed: 0.015, bobAmplitude: 15,
        type: 'ring', glow: 'rgba(255, 215, 0, 0.3)',
      },
      {
        x: 0.5, y: 0.35, baseY: 0.35, size: 40,
        rotation: 0, rotSpeed: -0.005, bobPhase: 1.5, bobSpeed: 0.02, bobAmplitude: 12,
        type: 'gift', glow: 'rgba(255, 100, 130, 0.25)',
      },
      {
        x: 0.8, y: 0.45, baseY: 0.45, size: 35,
        rotation: 0, rotSpeed: 0.006, bobPhase: 3.0, bobSpeed: 0.018, bobAmplitude: 18,
        type: 'lantern', glow: 'rgba(80, 200, 160, 0.3)',
      },
    ];

    // Confetti particles for gift box
    const confetti: ConfettiPiece[] = [];

    let time = 0;
    const reduceMotion = prefersReducedMotion();
    const animate = () => {
      time += 0.016;
      ctx.clearRect(0, 0, width, height);

      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;
      const parallaxX = (mx - 0.5) * 40;
      const parallaxY = (my - 0.5) * 25;

      // Draw dust motes
      for (const p of particles) {
        p.x += p.speedX + parallaxX * 0.003;
        p.y += p.speedY + parallaxY * 0.002;
        p.phase += 0.02;

        if (p.x < -10) p.x = width + 10;
        if (p.x > width + 10) p.x = -10;
        if (p.y < -10) p.y = height + 10;
        if (p.y > height + 10) p.y = -10;

        const flicker = 0.5 + Math.sin(p.phase) * 0.5;
        ctx.fillStyle = `hsla(${p.hue}, 60%, 75%, ${p.opacity * flicker})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw and update floating objects
      for (const obj of objects) {
        obj.bobPhase += obj.bobSpeed;
        obj.rotation += obj.rotSpeed;
        const px = obj.x * width + parallaxX * (obj.type === 'ring' ? 1.2 : obj.type === 'gift' ? 0.8 : 1.0);
        const py = obj.baseY * height + Math.sin(obj.bobPhase) * obj.bobAmplitude + parallaxY * 0.6;

        if (obj.type === 'ring') drawRing(ctx, px, py, obj.size, obj.rotation, time);
        else if (obj.type === 'gift') drawGift(ctx, px, py, obj.size, obj.rotation, time, confetti);
        else drawLantern(ctx, px, py, obj.size, obj.rotation, time);
      }

      // Draw and update confetti
      for (let i = confetti.length - 1; i >= 0; i--) {
        const c = confetti[i]!;
        c.x += c.vx;
        c.y += c.vy;
        c.vy += 0.03;
        c.life++;
        const lifeRatio = 1 - c.life / c.maxLife;
        if (lifeRatio <= 0) {
          confetti.splice(i, 1);
          continue;
        }
        ctx.fillStyle = c.color;
        ctx.globalAlpha = lifeRatio;
        ctx.fillRect(c.x, c.y, c.size, c.size * 0.6);
        ctx.globalAlpha = 1;
      }

      // Reduced motion: keep the single static frame already drawn.
      if (!reduceMotion) animFrameRef.current = requestAnimationFrame(animate);
    };

    animate();
    window.addEventListener('mousemove', handleMouseMove);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', resize);
    };
  }, [handleMouseMove]);

  return (
    <canvas
      ref={canvasRef}
      className={`celebration-hero-canvas ${className}`}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 0,
      }}
      aria-hidden="true"
    />
  );
}
