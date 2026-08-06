const CONFETTI_COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6', '#ef4444'];

interface ConfettiParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  w: number;
  h: number;
  rotation: number;
  rotationSpeed: number;
}

function launchConfettiBurst(originX: number, originY: number, count: number) {
  const canvas = document.createElement('canvas');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText =
    'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:99999';
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    canvas.remove();
    return;
  }

  const particles: ConfettiParticle[] = Array.from({ length: count }, () => ({
    x: originX,
    y: originY,
    vx: (Math.random() - 0.5) * 18,
    vy: Math.random() * -20 - 6,
    color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
    w: Math.random() * 10 + 5,
    h: Math.random() * 6 + 3,
    rotation: Math.random() * Math.PI * 2,
    rotationSpeed: (Math.random() - 0.5) * 0.35,
  }));

  let frame = 0;
  const animate = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.45;
      p.vx *= 0.99;
      p.rotation += p.rotationSpeed;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    frame += 1;
    if (frame < 130) {
      requestAnimationFrame(animate);
    } else {
      canvas.remove();
    }
  };
  requestAnimationFrame(animate);
}

export function celebrateTaskApproval(taskTitle?: string) {
  if (typeof window === 'undefined') return;

  const cx = window.innerWidth / 2;
  const cy = window.innerHeight * 0.55;
  launchConfettiBurst(cx, cy, 160);
  launchConfettiBurst(window.innerWidth * 0.25, cy, 80);
  launchConfettiBurst(window.innerWidth * 0.75, cy, 80);

  const banner = document.createElement('div');
  banner.setAttribute('role', 'status');
  banner.className =
    'fixed left-1/2 top-1/3 z-[100000] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-green-200 bg-white/95 px-6 py-5 shadow-2xl text-center max-w-[90vw]';
  banner.style.opacity = '0';
  banner.style.transform = 'translate(-50%, -50%) scale(0.9)';
  banner.style.transition = 'opacity 250ms ease, transform 250ms ease';
  banner.innerHTML = `
    <div style="font-size:3rem;line-height:1;margin-bottom:0.5rem">🎉</div>
    <p style="font-size:1.125rem;font-weight:700;color:#166534;margin:0">Task Approved!</p>
    <p style="font-size:0.875rem;color:#4b5563;margin:0.5rem 0 0;max-width:280px">${taskTitle ? `“${taskTitle.replace(/"/g, '&quot;')}” is complete.` : 'Your task has been marked complete.'}</p>
  `;
  document.body.appendChild(banner);
  requestAnimationFrame(() => {
    banner.style.opacity = '1';
    banner.style.transform = 'translate(-50%, -50%) scale(1)';
  });
  window.setTimeout(() => {
    banner.style.transition = 'opacity 300ms ease';
    banner.style.opacity = '0';
    window.setTimeout(() => banner.remove(), 320);
  }, 3200);
}
