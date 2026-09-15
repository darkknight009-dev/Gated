# Design research

Research performed April 2026. References are principles, not templates; no exact layouts, colors, logos, copy, or animations were copied.

## Products studied

- **Linear:** quiet chrome, selection-first list hierarchy, fast transitions, keyboard affordances, small typography.
- **Superhuman:** email density, command-led actions, triage speed, readable message pane, shortcut teaching.
- **Raycast:** keyboard-first information architecture, compact uniform rows, high-contrast selected state, physical key hints.
- **Vercel:** typography discipline, near-monochrome surfaces, clear technical metadata, precise spacing.
- **Resend:** editorial black/white confidence, restrained technical details, content-led marketing.
- **Stripe / Ramp:** trust through plain explanations, progressive disclosure, exact status language, operational dashboards.
- **Notion / Figma:** tool surfaces that prioritize direct manipulation and familiar keyboard behavior.
- **Arc:** opinionated product voice and navigation concepts distinct from category incumbents.
- **Perplexity:** answer/evidence hierarchy and progressive context.
- **Notion Calendar (Cron):** dense scheduling chrome, restrained separators, immediate interaction feedback.

## Sources consulted

- Current product websites and public product surfaces for Raycast, Linear, Vercel, and Gmail-related integrations.
- Raycast public design-system analyses describing compact rows, restrained radius, subtle borders, keyboard keycaps, and product/marketing continuity.
- Supabase official SSR Auth, RLS, Queues, and Postgres guidance.
- Google official Gmail `users.watch` API and history synchronization documentation.
- OpenAI Structured Outputs, Anthropic native structured outputs, and Google Gemini structured output documentation.

## Findings translated to Gated

1. **Dense product, spacious marketing.** Inbox rows remain compact; the landing page has editorial pacing.
2. **Selection must be unmistakable.** Gated uses a warm-neutral selected surface plus a 3px chartreuse threshold edge.
3. **The keyboard changes layout.** Commands and shortcuts are visible in-context, not buried in documentation.
4. **Trust copy must be literal.** Sync, retention, analysis, and errors state what happened and whether email is safe.
5. **Avoid card dashboards.** Inbox, People, and settings are flat lists separated mostly by spacing and hairlines.
6. **One accent is enough.** Acid chartreuse means permission, entry, or primary action—not decorative “AI.”
7. **Product and marketing should share DNA.** Both use the gate mark, mono threshold metadata, warm bone, charcoal, and editorial Newsreader moments.

## Original visual language

Gated’s metaphor is a threshold: a narrow vertical signal edge, “enter/hold” language, sharp editorial typography, and small calibrated scores. It does not use doors, gates, robots, or sparkles. Its combination of warm paper neutrals, acid signal, serif display, compact grotesk interface, and black square threshold mark is specific to Gated.

## Visual QA conclusions

- Removed gradient backgrounds, glows, blur, and floating hero cards.
- Limited radii to 4/6/10px and used no giant pills.
- Kept score secondary to sender and subject.
- Created separate mobile list/detail architecture with bottom actions.
- Kept email body at comfortable measure and line-height.
- Added reduced-motion and high-visibility focus styles.