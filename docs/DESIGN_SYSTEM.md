# Gated design system

## Principles

1. **Threshold, not dashboard.** Communicate entry, permission, and signal without literal gate imagery.
2. **The message stays primary.** Scores and AI evidence clarify; they do not overpower sender/subject/content.
3. **Quiet confidence.** Typography and alignment establish hierarchy before borders or elevation.
4. **Fast by construction.** 100–130ms transitions, compact hit paths, command access, no cinematic motion.
5. **Trust is visible.** Error, privacy, sync, confidence, and estimate labels are first-class UI.

## Tokens

All colors live in `src/app/globals.css` variables.

- Canvas: warm bone `--bg`; product surface `--surface`; message surface `--surface-raised`.
- Ink: charcoal `--ink`, soft ink, muted, and faint tiers.
- Accent: `--signal` acid chartreuse. Meaning: allowed through, selected priority, explicit primary action.
- Critical/warning/success/focus are functional only.
- Dark theme is independently tuned with olive-charcoal surfaces and off-white text.

## Typography

- Display/brand moments: locally bundled **Newsreader Variable**, tight tracking.
- Interface/body: locally bundled **Manrope Variable**, compact and readable.
- Machine metadata/scores/shortcuts: system monospace stack.
- Email content: 14px/1.78 in product detail for extended reading.

## Space and shape

The implementation follows 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80px rhythm. Workhorse radius is 6px; larger menus use 10px; key hints use 4px. Circular avatars are the main exception. Shadows are reserved for modal command UI.

## Components

- `btn`: 42px accessible minimum action with signal/ink/secondary/danger variants.
- `input`: high-contrast surface, visible focus ring, 6px radius.
- `email-row`: compact three-column scan unit; score, message, time.
- `attention-strip`: score plus confidence and concise evidence, never chain-of-thought.
- `command`: modal command surface with keyboard labels.
- `settings-panel`: flat grouped rows with hairline separators.

## Accessibility

Semantic page regions, labels, live error/status regions, keyboard list movement, focus-visible rings, reduced-motion support, readable contrasts, 42px main actions, and mobile touch navigation are present. Icons are supplemental and actions receive labels.