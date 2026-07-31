import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { PanelRightOpen, Sparkles, Waves } from "lucide-react";
import { PerlinBackground } from "@/components/PerlinBackground";
import { RippleCanvas } from "@/components/RippleCanvas";
import { ImpactDrawer } from "@/components/ImpactDrawer";
import { EXAMPLE_ACTIONS, parseAction, type RippleResult } from "@/lib/ripple-engine";

const TITLE = "The Ripple Effect — The Future Starts Here";
const DESC =
  "Type one small action and watch it ripple outward into six or seven future consequences, drawn live on an accessible flow-field canvas.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

interface Notice {
  reason: string;
  suggestion: string;
}

function Index() {
  const [input, setInput] = useState("");
  const [result, setResult] = useState<RippleResult | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const run = useCallback((raw: string) => {
    const outcome = parseAction(raw);
    if (!outcome.ok) {
      setNotice({ reason: outcome.reason, suggestion: outcome.suggestion });
      return;
    }
    setNotice(null);
    setResult(outcome);
    setActiveIndex(0);
    setDrawerOpen(true);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const id = window.setTimeout(() => setNotice(null), 9000);
    return () => window.clearTimeout(id);
  }, [notice]);

  const active = result?.nodes[activeIndex];

  return (
    <>
      <PerlinBackground />

      <a
        href="#prompt-input"
        className="sr-only rounded-md bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50"
      >
        Skip to the action prompt
      </a>

      <div
        className={`min-h-dvh transition-[padding] duration-300 ease-out ${
          drawerOpen ? "md:pr-[26rem]" : ""
        }`}
      >
        <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-6">
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
            <Waves className="size-4 text-primary" aria-hidden="true" />
            The Future Starts Here
          </p>
          <button
            type="button"
            onClick={() => setDrawerOpen((o) => !o)}
            aria-expanded={drawerOpen}
            aria-controls="impact-drawer"
            className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/50 px-4 py-2 text-sm font-medium text-foreground backdrop-blur-md transition-all hover:bg-card/80 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <PanelRightOpen className="size-4" aria-hidden="true" />
            Impact breakdown
          </button>
        </header>

        <main className="mx-auto w-full max-w-6xl px-5 pb-24">
          <section className="mx-auto max-w-3xl pt-6 text-center md:pt-12">
            <h1 className="font-display text-[clamp(2.6rem,7vw,4.75rem)] font-semibold leading-[0.98] tracking-tight text-foreground">
              The Ripple Effect
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-balance text-base leading-relaxed text-muted-foreground md:text-lg">
              Every future is downstream of something small. Name one action and watch it travel —
              from this minute to the people who inherit it.
            </p>
          </section>

          <section className="mx-auto mt-9 max-w-2xl">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                run(input);
              }}
              className="rounded-[1.75rem] border border-border/70 bg-card/45 p-2 shadow-[0_24px_60px_-32px_rgba(0,0,0,0.95)] backdrop-blur-xl transition-shadow focus-within:border-primary/60"
            >
              <label htmlFor="prompt-input" className="sr-only">
                Describe a small action
              </label>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  id="prompt-input"
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Plant a tree…"
                  autoComplete="off"
                  aria-describedby="prompt-help"
                  className="min-w-0 flex-1 rounded-3xl bg-transparent px-5 py-3.5 text-base text-foreground placeholder:text-muted-foreground/80 focus:outline-none"
                />
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-2 rounded-3xl bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground transition-transform hover:brightness-110 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  <Sparkles className="size-4" aria-hidden="true" />
                  Send the ripple
                </button>
              </div>
            </form>

            <p id="prompt-help" className="mt-3 text-center text-xs text-muted-foreground">
              Constructive actions only — harmful inputs are gently turned back.
            </p>

            <ul className="mt-4 flex flex-wrap justify-center gap-2">
              {EXAMPLE_ACTIONS.map((example) => (
                <li key={example}>
                  <button
                    type="button"
                    onClick={() => {
                      setInput(example);
                      run(example);
                    }}
                    className="rounded-full border border-border/60 bg-secondary/40 px-3.5 py-1.5 text-xs font-medium text-muted-foreground transition-all hover:border-primary/60 hover:text-foreground active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {example}
                  </button>
                </li>
              ))}
            </ul>
          </section>

          {/* Corrective notification ripple */}
          <div aria-live="assertive" className="mx-auto mt-6 max-w-2xl">
            {notice && (
              <div
                role="alert"
                className="ripple-in rounded-2xl border border-destructive/50 bg-destructive/15 px-5 py-4 text-left backdrop-blur-md"
              >
                <p className="text-sm font-semibold text-foreground">{notice.reason}</p>
                <p className="mt-1 text-sm text-muted-foreground">{notice.suggestion}</p>
              </div>
            )}
          </div>

          <section className="mt-10" aria-label="Ripple visualiser">
            {result ? (
              <RippleCanvas
                nodes={result.nodes}
                activeIndex={activeIndex}
                onSelect={setActiveIndex}
              />
            ) : (
              <div className="flex h-[clamp(320px,52vh,520px)] items-center justify-center rounded-3xl border border-dashed border-border/50 bg-card/25 px-8 text-center backdrop-blur-md">
                <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
                  The water is still. Send an action and the chain of consequences will draw itself
                  here — click or arrow-key through each ripple.
                </p>
              </div>
            )}
          </section>

          {active && (
            <section
              aria-live="polite"
              className="mx-auto mt-8 max-w-3xl rounded-3xl border border-border/60 bg-card/45 p-6 backdrop-blur-xl md:p-8"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
                {active.horizon} · step {activeIndex + 1} of {result?.nodes.length}
              </p>
              <h2 className="mt-2 font-display text-2xl leading-tight text-foreground md:text-3xl">
                {active.title}
              </h2>
              <p className="mt-3 text-base leading-relaxed text-muted-foreground">{active.detail}</p>
            </section>
          )}
        </main>

        <footer className="border-t border-border/40 px-5 py-8 text-center text-xs text-muted-foreground">
          One small act. Thousands of consequences. Built for keyboard and screen readers.
        </footer>
      </div>

      <ImpactDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        action={result?.action ?? ""}
        domainLabel={result?.domainLabel ?? "Awaiting an action"}
        nodes={result?.nodes ?? []}
        activeIndex={activeIndex}
        onSelect={setActiveIndex}
      />
    </>
  );
}
