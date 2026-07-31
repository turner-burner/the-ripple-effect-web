import { ChevronRight, X } from "lucide-react";
import type { RippleNode } from "@/lib/ripple-engine";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action: string;
  domainLabel: string;
  nodes: RippleNode[];
  activeIndex: number;
  onSelect: (i: number) => void;
}

export function ImpactDrawer({
  open,
  onOpenChange,
  action,
  domainLabel,
  nodes,
  activeIndex,
  onSelect,
}: Props) {
  return (
    <>
      {open && (
        <button
          type="button"
          tabIndex={-1}
          aria-hidden="true"
          onClick={() => onOpenChange(false)}
          className="fixed inset-0 z-30 cursor-default bg-background/60 backdrop-blur-sm md:hidden"
        />
      )}

      <aside
        id="impact-drawer"
        aria-label="Impact breakdown"
        aria-hidden={!open}
        className={`fixed right-0 top-0 z-40 flex h-dvh w-[min(26rem,100vw)] flex-col border-l border-border/60 bg-card/85 backdrop-blur-xl transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border/50 px-6 py-5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {domainLabel}
            </p>
            <h2 className="mt-1 font-display text-xl leading-tight text-foreground">
              {action || "No ripple yet"}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            tabIndex={open ? 0 : -1}
            aria-label="Close impact breakdown"
            className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        <ol className="flex-1 space-y-2 overflow-y-auto px-4 py-4">
          {nodes.length === 0 && (
            <li className="px-2 py-6 text-sm text-muted-foreground">
              Describe an action to see its consequence chain here.
            </li>
          )}
          {nodes.map((node, i) => {
            const active = i === activeIndex;
            return (
              <li key={node.id}>
                <button
                  type="button"
                  tabIndex={open ? 0 : -1}
                  onClick={() => onSelect(i)}
                  aria-current={active ? "step" : undefined}
                  className={`w-full rounded-2xl border px-4 py-3 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    active
                      ? "border-primary/70 bg-primary/15 shadow-[0_8px_24px_-14px_rgba(0,0,0,0.9)]"
                      : "border-transparent bg-secondary/40 hover:border-border hover:bg-secondary/70"
                  }`}
                >
                  <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    <span className="tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                    <ChevronRight className="size-3" aria-hidden="true" />
                    {node.horizon}
                  </span>
                  <span className="mt-1 block font-display text-base text-foreground">{node.title}</span>
                  <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">
                    {node.detail}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </aside>
    </>
  );
}
