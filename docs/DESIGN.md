# Design Direction

## Principles

- Calm, operational, and trustworthy rather than speculative
- Dense enough for repeated portfolio monitoring
- Clear separation between proposal, policy validation, and execution
- Transaction status and risk limits are visible at the point of action
- Real chain data is never visually indistinguishable from demo data

## Visual system

Use near-white primary surfaces with restrained sage, peach, and mineral accents.
Reserve dark surfaces for architecture and high-contrast operational moments.
Typography may pair an editorial display face with a practical sans-serif UI
face, while compact dashboard headings remain appropriately sized.

Cards represent individual vaults, decisions, or transactions. Page sections
remain unframed. Keep radii at 8 px or less and use familiar icons for wallet,
copy, explorer, status, and navigation actions.

## Interaction requirements

- Wallet and transaction controls expose pending, success, error, and rejection
  states without moving the layout.
- The decision view shows target allocation, reason, input time, policy result,
  transaction, and explorer link.
- Mobile layouts retain the full financial workflow, not a reduced marketing
  experience.
- Motion supports hierarchy and state changes; it never delays transactions.

## Production inheritance

The existing `prototype/` remains the visual reference and must not be treated
as disposable exploration. Production work should reuse its strongest product
surfaces while replacing all simulated behavior.

- Preserve the editorial serif and compact sans-serif hierarchy.
- Preserve the quiet dashboard density, thin dividers, restrained accent
  surfaces, and dark agent panel.
- Use GSAP for meaningful entrance, state-change, and narrative motion.
- Respect `prefers-reduced-motion` and never animate transaction feedback in a
  way that hides status or delays action.
- Use the production component system rather than copying prototype markup
  directly. The prototype establishes visual intent; the Next.js app owns the
  maintained implementation.

The production app should feel more polished than the prototype, not visually
generic because the architecture changed.
