# Visual thesis: the incident room's proof sheet

Config Drift Timeline uses a single-mode, dithered/halftone print system. A
deployment history is evidence: stamped, compared, and annotated rather than
polished into a generic dashboard. The visual language borrows registration
marks, proofing ink, perforated paper, and coarse newspaper dots to make
provenance feel physical and legible.

## Palette

The site is deliberately light-only, like a fresh proof sheet. Every surface
is painted explicitly.

| Token | Value | Role |
| --- | --- | --- |
| Paper | `#f4f0e6` | page background |
| Clean paper | `#fffdf7` | raised demo surface |
| Carbon | `#171817` | primary ink and borders |
| Quiet ink | `#55564f` | supporting copy |
| Signal red | `#c83b2f` | unsafe drift and primary action |
| Registry blue | `#155b78` | provenance, links, focus |
| Moss | `#2f6a50` | resolved/verified state |
| Amber | `#8a5a00` | warnings and null values |

Signal red and registry blue echo the two misregistered plates of a print run:
the visual analogue of two environments that should line up but do not. Body
text on paper exceeds 11:1; all interactive and status pairings exceed 4.5:1.

## Type

- Display: `Arial Black`, `Impact`, `Franklin Gothic Heavy`, sans-serif. Its
  blunt condensed forms read like a stamped incident label.
- Working text: `ui-monospace`, `SFMono-Regular`, `Cascadia Code`, `Roboto
  Mono`, monospace. This keeps keys, actors, and timestamps aligned without a
  font download.

No remote fonts or font files ship. The scale is 14 / 16 / 20 / 32 / clamp
40–76px, with tabular numerals for all timeline data.

## Spacing and structure

An 8px base rhythm uses 4, 8, 12, 16, 24, 32, 48, 64, and 96px. Main content
is capped at 1180px. Large editorial fields hold short copy; dense evidence
uses aligned columns. Rules group sequences, while boxes are reserved for
independent snapshots, the demo, and purchase/license state.

On a 390px viewport, the navigation condenses, hero copy stacks before the
illustration, comparison columns become labelled rows, and the demo remains
operable without horizontal page scrolling. Controls remain at least 44px.

## Interaction grammar

- Primary actions are red ink blocks with a 2px carbon shadow that collapses
  on press, like a stamp touching paper.
- Links use a blue underline offset like an editor's annotation.
- Timeline selection moves a registration target along one fixed rail. The
  evidence panel updates in place and is announced politely.
- Focus is a 3px registry-blue outline with a paper gap. State is always
  communicated with labels and symbols, never color alone.
- Empty, offline, invalid-license, and verified states each name what happened
  and offer a next action.

## Motion policy

One 240ms ease-out transition moves the timeline target and fades its evidence
sheet. Buttons move only 2px on press. The halftone illustration never loops.
With `prefers-reduced-motion: reduce`, transitions and transforms become
instant while hierarchy, target position, and state labels remain intact.

## Original asset plan and provenance

The hero is a generated editorial still: a branching strip of perforated
configuration paper passing through a compact forensic registration machine,
with one red misaligned branch and blue proof marks. It explains the product's
job rather than decorating the page. It contains no product UI, logos, or
text, and is rendered with a restricted two-ink halftone treatment.

Generation prompt (verbatim):

> Use case: stylized-concept. Asset type: wide landing-page hero illustration
> for a local configuration drift CLI. Primary request: an editorial
> screen-print illustration of two long perforated configuration paper strips
> feeding through a compact forensic registration machine; the strips align
> at first, then one branch slips out of register and is marked by a single
> vermilion signal tab. Scene/backdrop: warm uncoated off-white paper.
> Style/medium: limited-ink 1960s technical manual, coarse halftone dots,
> stipple, imperfect ink registration, crisp silhouettes, tactile paper grain.
> Composition/framing: wide 3:2 composition, machine centered, strong diagonal
> paper path, generous breathing room, readable at small sizes. Color palette:
> carbon black, registry blue, vermilion red, warm paper only. Constraints: no
> words, no letters, no numbers, no logos, no UI screenshot, no gradients, no
> photorealism, no watermark.

Generated with `/opt/fleet/lib/gen-image.sh`, deployment `factory-image`. The
generated PNG is a project-owned original and is converted locally to WebP;
the exact deployment metadata is retained beside the source in
`site/public/art/hero-drift.png.json`. License: released with this project
under MIT.

`site/public/art/social-preview.jpg` is a hand-composed 1200×630 center crop
of that same project-owned hero, made locally with ImageMagick for social-card
metadata. It introduces no new artwork or external license.

Small arrows, registration marks, and status glyphs are hand-made in CSS or
inline SVG, authored for this project, and covered by the repository license.
