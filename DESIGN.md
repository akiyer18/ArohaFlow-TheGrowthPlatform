# Design: ArohaFlow

The locked system. Every Hallmark run reads this first and the screens share it. Change it on purpose; this file is the rule.

## System
- Genre: modern-minimal
- Shape: app screen (every OS screen lives inside `OsShell`)
- Theme: Coral (deal 1/3, seed calm-personal-day-planner-5ffd·749c7d25·2026-11-24·r0)
- Axes: light/grotesk-sans/warm · posture: restrained
- Vibe: calm planning, warm paper, one coral signal, nothing shouts

## Tokens
`src/tokens.css` is the source of truth. The roles:
```css
:root {
  --color-paper: oklch(97% 0.006 55);  --color-paper-2: oklch(94.5% 0.007 55);  --color-paper-3: oklch(91.5% 0.009 55);
  --color-ink: oklch(21% 0.012 38);  --color-ink-2: oklch(29% 0.013 40);  --color-muted: oklch(47% 0.013 45);  --color-rule: oklch(87% 0.009 55);
  --color-accent: oklch(74% 0.125 30);  --color-accent-2: oklch(54% 0.165 29);  --color-focus: oklch(54% 0.17 30);
  --color-cotton: oklch(98.8% 0.0045 80);  --color-board: oklch(22% 0.011 40);  --color-paid: oklch(55.5% 0.15 33);
  --font-display: "General Sans", ui-sans-serif, system-ui, sans-serif;  --font-body: var(--font-display);  --font-outlier: "Geist Mono", ui-monospace, monospace;
  --radius-card: 8px;  --radius-input: 6px;  --radius-pill: 999px;  --rule-hair: 1px;
}
```
Spacing, type scale (ratio 1.2), easings and durations live in `src/tokens.css`. Shared screen primitives (`os-panel`, `os-btn`, `os-list`, `os-state`, `os-fig`) live in `src/os/os.css`; each screen adds one stylesheet with its own prefix (`td-` Today, `hb-` Habits).

## Surfaces
- Paper is the ground. Records the user acts on are cotton cards (`--edge-stock`, `--cast-stock`); never a card inside a card.
- A choice of two to five is a groove pressed into paper (`--press-groove`) with a cotton card riding to the chosen stop (nav, day rhythm, grade scale).
- Coral is spent only on: focus, the next / current item, the now line, the points meter, and the pressed "Done" of a settled check-in.
- Missed or lapsed is never red; it is quiet paper.

## Controls
- Primary: ink board (`--color-board`), 8px radius, 40px tall, one per region.
- Secondary: cotton letterpress card, same radius and height; hover lifts 1px, active presses 1px.
- Inputs: 44px, 6px radius, 1px muted border, coral focus.
- Figures in columns use Geist Mono (`.os-fig`); figures in sentences stay General Sans.

## Screens
- Every data region draws four states: loading (skeleton), empty (what belongs here and how it fills), error, full.
- Labels are sentence case, never tracked capitals. No dashes in copy.

## Motion
- Character: calm. Route changes crossfade with an 8px rise (280ms in, 140ms out, `--ease-out`); the nav card slides by layout spring. No reveal on load. Under reduced motion everything ends at once.

## Exports
`src/tokens.css` in this project; Tailwind's legacy `app-*` colours remain only for screens not yet moved into the shell.
