import { useEffect, useMemo, useRef, useState } from "react";
import type { RippleNode } from "@/lib/ripple-engine";

interface Props {
  nodes: RippleNode[];
  activeIndex: number;
  onSelect: (index: number) => void;
}

interface Point {
  x: number;
  y: number;
}

const RING_COLORS = ["rgba(132,169,140,0.55)", "rgba(203,226,203,0.35)"];

function layout(nodes: RippleNode[], w: number, h: number): Point[] {
  const padX = Math.min(90, w * 0.12);
  const usable = Math.max(1, w - padX * 2);
  const step = nodes.length > 1 ? usable / (nodes.length - 1) : 0;
  const amp = Math.min(h * 0.28, 120);
  return nodes.map((_, i) => ({
    x: padX + step * i,
    y: h / 2 + Math.sin(i * 0.95 + 0.4) * amp * (0.4 + (i / Math.max(1, nodes.length - 1)) * 0.6),
  }));
}

export function RippleCanvas({ nodes, activeIndex, onSelect }: Props) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [size, setSize] = useState({ w: 900, h: 420 });
  const stateRef = useRef({ nodes, activeIndex, size });

  const points = useMemo(() => layout(nodes, size.w, size.h), [nodes, size]);
  stateRef.current = { nodes, activeIndex, size };

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ w: Math.max(320, width), h: Math.max(280, height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let raf = 0;
    let t = 0;

    const render = () => {
      const { nodes: ns, activeIndex: ai, size: sz } = stateRef.current;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = sz.w * dpr;
      canvas.height = sz.h * dpr;
      canvas.style.width = `${sz.w}px`;
      canvas.style.height = `${sz.h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, sz.w, sz.h);

      const pts = layout(ns, sz.w, sz.h);
      if (!pts.length) return;

      // connecting chain
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = "rgba(203,226,203,0.32)";
      ctx.beginPath();
      pts.forEach((p, i) => {
        if (i === 0) ctx.moveTo(p.x, p.y);
        else {
          const prev = pts[i - 1];
          const mx = (prev.x + p.x) / 2;
          ctx.bezierCurveTo(mx, prev.y, mx, p.y, p.x, p.y);
        }
      });
      ctx.stroke();

      pts.forEach((p, i) => {
        const node = ns[i];
        const base = 10 + node.magnitude * 16;
        const isActive = i === ai;

        // expanding ripples
        const ringCount = isActive ? 3 : 2;
        for (let r = 0; r < ringCount; r++) {
          const phase = ((t / (isActive ? 90 : 150) + r / ringCount + i * 0.13) % 1);
          const radius = base + phase * (isActive ? 92 : 54);
          ctx.beginPath();
          ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
          ctx.lineWidth = isActive ? 1.8 : 1;
          ctx.strokeStyle = RING_COLORS[r % RING_COLORS.length].replace(
            /[\d.]+\)$/,
            `${((1 - phase) * (isActive ? 0.6 : 0.28)).toFixed(3)})`,
          );
          ctx.stroke();
        }

        // core
        const pulse = reduced ? 0 : Math.sin(t / 40 + i) * 1.4;
        const grd = ctx.createRadialGradient(p.x, p.y, 1, p.x, p.y, base + 8);
        grd.addColorStop(0, isActive ? "rgba(216,240,214,0.98)" : "rgba(178,209,182,0.85)");
        grd.addColorStop(1, "rgba(82,121,111,0.05)");
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(p.x, p.y, base + pulse, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(p.x, p.y, base + pulse, 0, Math.PI * 2);
        ctx.lineWidth = isActive ? 2.5 : 1.2;
        ctx.strokeStyle = isActive ? "rgba(232,247,230,0.95)" : "rgba(203,226,203,0.6)";
        ctx.stroke();
      });
    };

    const loop = () => {
      t += 1;
      render();
      raf = requestAnimationFrame(loop);
    };

    render();
    if (!reduced) raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const onKeyDown = (e: React.KeyboardEvent, i: number) => {
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      onSelect(Math.min(nodes.length - 1, i + 1));
      focusNode(Math.min(nodes.length - 1, i + 1));
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      onSelect(Math.max(0, i - 1));
      focusNode(Math.max(0, i - 1));
    } else if (e.key === "Home") {
      e.preventDefault();
      onSelect(0);
      focusNode(0);
    } else if (e.key === "End") {
      e.preventDefault();
      onSelect(nodes.length - 1);
      focusNode(nodes.length - 1);
    }
  };

  const focusNode = (i: number) => {
    requestAnimationFrame(() => {
      wrapRef.current?.querySelector<HTMLButtonElement>(`[data-node-index="${i}"]`)?.focus();
    });
  };

  return (
    <div
      ref={wrapRef}
      className="relative h-[clamp(320px,52vh,520px)] w-full overflow-hidden rounded-3xl border border-border/60 bg-card/40 backdrop-blur-md"
    >
      <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0" />

      <ul
        className="absolute inset-0 list-none"
        aria-label="Consequence chain — use arrow keys to move between ripples"
      >
        {points.map((p, i) => {
          const node = nodes[i];
          const active = i === activeIndex;
          return (
            <li key={node.id} className="absolute" style={{ left: p.x, top: p.y }}>
              <button
                type="button"
                data-node-index={i}
                aria-current={active ? "step" : undefined}
                aria-label={`Step ${i + 1} of ${nodes.length}. ${node.horizon}: ${node.title}`}
                onClick={() => onSelect(i)}
                onFocus={() => onSelect(i)}
                onKeyDown={(e) => onKeyDown(e, i)}
                className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full transition-transform duration-200 hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-95"
                style={{ width: 56, height: 56 }}
              >
                <span className="sr-only">{node.detail}</span>
              </button>
              <span
                aria-hidden="true"
                className={`pointer-events-none absolute left-1/2 top-9 w-36 -translate-x-1/2 text-center text-[11px] font-medium uppercase tracking-[0.14em] ${
                  active ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {node.horizon}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
