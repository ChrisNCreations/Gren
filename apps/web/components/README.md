# Web components

The production UI is organized by responsibility:

- `landing/`: marketing homepage at `/` (hero, principles, story, architecture, proof, CTA)
- `app-sidebar.tsx`: desktop and mobile application navigation
- `page-heading.tsx`: page identity and transaction actions
- `brand-mark.tsx`: shared Gren product mark
- `dashboard/overview-view.tsx`: portfolio, policy, agent, and activity overview
- `dashboard/agent-panel.tsx`: preview Evaluate and Test policy reject controls
- `dashboard/vaults-view.tsx`: risk-specific vault selection
- `dashboard/status-views.tsx`: decision and activity empty/pending states

Shared product data lives in `lib/dashboard.ts`. Dashboard reveal motion lives in `hooks/use-reveal-motion.ts`; landing scroll motion lives in `hooks/use-landing-motion.ts`.
Wallet, transaction, and decision components should follow the same boundaries
rather than returning the application to one large page file.
