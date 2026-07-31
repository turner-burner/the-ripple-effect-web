import { useEffect, useRef } from "react";

/**
 * Soothing flow-field background built on a small value-noise field
 * (Perlin-style gradient interpolation), rendered at low resolution and
 * scaled up for cheap, smooth motion.
 */

const PALETTE = [
  [47, 62, 70], // #2f3e46
  [53, 79, 82], // #354f52
  [82, 121, 111], // #52796f
  [132, 169, 140], // #84a98c
];

function makeNoise(seed: number) {
  const size = 256;
  const perm = new Uint8Array(size * 2);
  const base = new Uint8Array(size);
  for (let i = 0; i < size; i++) base[i] = i;
  let s = seed;
  for (let i = size - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = s % (i + 1);
    const t = base[i];
    base[i] = base[j];
    base[j] = t;
  }
  for (let i = 0; i < size * 2; i++) perm[i] = base[i % size];

  const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const grad = (hash: number, x: number, y: number, z: number) => {
    const h = hash & 15;
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  };

  return (x: number, y: number, z: number) => {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const Z = Math.floor(z) & 255;
    x -= Math.floor(x);
    y -= Math.floor(y);
    z -= Math.floor(z);
    const u = fade(x);
    const v = fade(y);
    const w = fade(z);
    const A = perm[X] + Y;
    const AA = perm[A & 255] + Z;
    const AB = perm[(A + 1) & 255] + Z;
    const B = perm[(X + 1) & 255] + Y;
    const BA = perm[B & 255] + Z;
    const BB = perm[(B + 1) & 255] + Z;

    return lerp(
      lerp(
        lerp(grad(perm[AA & 255], x, y, z), grad(perm[BA & 255], x - 1, y, z), u),
        lerp(grad(perm[AB & 255], x, y - 1, z), grad(perm[BB & 255], x - 1, y - 1, z), u),
        v,
      ),
      lerp(
        lerp(grad(perm[(AA + 1) & 255], x, y, z - 1), grad(perm[(BA + 1) & 255], x - 1, y, z - 1), u),
        lerp(
          grad(perm[(AB + 1) & 255], x, y - 1, z - 1),
          grad(perm[(BB + 1) & 255], x - 1, y - 1, z - 1),
          u,
        ),
        v,
      ),
      w,
    );
  };
}

function sample(t: number) {
  const clamped = Math.min(0.999, Math.max(0, t)) * (PALETTE.length - 1);
  const i = Math.floor(clamped);
  const f = clamped - i;
  const a = PALETTE[i];
  const b = PALETTE[Math.min(PALETTE.length - 1, i + 1)];
  return [
    Math.round(a[0] + (b[0] - a[0]) * f),
    Math.round(a[1] + (b[1] - a[1]) * f),
    Math.round(a[2] + (b[2] - a[2]) * f),
  ];
}

export function PerlinBackground() {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const W = 150;
    const H = 90;
    canvas.width = W;
    canvas.height = H;
    const image = ctx.createImageData(W, H);
    const noise = makeNoise(20260730);

    let raf = 0;
    let z = 0;

    const draw = () => {
      const data = image.data;
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const n =
            noise(x * 0.022, y * 0.03, z) * 0.65 +
            noise(x * 0.055, y * 0.06, z * 1.6 + 40) * 0.35;
          const t = (n + 0.72) / 1.44;
          const [r, g, b] = sample(t);
          const idx = (y * W + x) * 4;
          data[idx] = r;
          data[idx + 1] = g;
          data[idx + 2] = b;
          data[idx + 3] = 255;
        }
      }
      ctx.putImageData(image, 0, 0);
    };

    const loop = () => {
      z += 0.0022;
      draw();
      raf = requestAnimationFrame(loop);
    };

    draw();
    if (!reduced) raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-background">
      <canvas
        ref={ref}
        className="h-full w-full scale-110 blur-[2px]"
        style={{ imageRendering: "auto", filter: "saturate(0.9)" }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_20%,transparent_10%,rgba(19,26,29,0.82)_85%)]" />
    </div>
  );
}
