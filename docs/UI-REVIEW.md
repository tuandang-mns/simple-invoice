# UI review (taste audit)

The frontend was audited against the open-source [taste-skill](https://github.com/Leonxlnx/taste-skill) rules (`taste-skill` + `redesign-skill`), which target "generic AI-generated UI" patterns.

**Scope note.** That skill is written for landing pages and explicitly excludes dashboards and data tables. So only the rules that apply to a finance tool were used: typography, colour, shape, content, states and accessibility. The landing-page rules (hero, scroll animation, bento grids, imagery) were deliberately not applied.

**Design read:** redesign (preserve) of an internal B2B invoicing tool for finance staff, with a calm, trust-first visual language on the existing MUI system.
**Dials:** variance 3 · motion 2 · density 6.

## Findings and changes

| Area | Before | After |
|---|---|---|
| Typography | Theme named Inter, but it was never loaded, so the browser's fallback font was used. Proportional digits in amounts. | **Geist** (variable), self-hosted, so it's allowed by the CSP's `font-src 'self'`. Tighter heading tracking. **Tabular digits** in every table cell, so amounts line up. |
| Colour | Blue gradient on the login page (the typical "AI gradient" look). An unused orange secondary colour. Default greys. | Neutral canvas. **One accent** (brand navy `#1e4e79`, close to the 101 Digital brand blue). One cool-grey family. Off-black text. |
| Header | Solid navy app bar | Light header with a hairline border and a navy wordmark. One line, 64 px. |
| Status | Filled Pending/Paid/Overdue chips next to an outlined Draft chip; saturated pills | One **tinted** style for all four (soft background + same-hue text), all ≥ 6:1 contrast |
| Shape | One radius (10 px) on everything | Documented rule: containers 12 px · controls 8 px · chips 6 px |
| Copy | "created — status Overdue"; "—" shown for empty fields | No em-dashes in the UI: "…created. Status: Overdue", empty fields show "Not provided" |
| Seed data | "Acme Holdings Pte Ltd" | "Harbourline Freight Pte Ltd" |
| States | No press feedback; table rows had no visible keyboard focus | Subtle press effect on buttons, focus ring on rows, **`prefers-reduced-motion`** respected globally |
| Accessibility | No `<main>` landmark, no skip link, no meta description | `<main id="main">`, a **Skip to content** link (first Tab stop), meta description |
| Form hints | — | "Blank = 10% default" (tax), "Amount, not a percentage" (discount) |

## Contrast (WCAG 2.1 AA, minimum 4.5:1)

| Pair | Ratio |
|---|---|
| Body text on canvas | 16.6:1 |
| Secondary text on white / canvas | 7.7:1 / 7.2:1 |
| Button text on navy | 8.7:1 |
| Draft / Pending / Paid / Overdue chip | 9.2 / 6.1 / 6.5 / 6.1 :1 |

## Deliberately not done

- **Dark mode.** The skill requires it for consumer-facing pages. This is an internal tool, so the theme is locked to light (roadmap item).
- **Icon library swap.** MUI icons are one consistent family; changing libraries adds churn without visible benefit.
- **Motion and imagery.** These are landing-page techniques and don't fit a data-entry tool.
