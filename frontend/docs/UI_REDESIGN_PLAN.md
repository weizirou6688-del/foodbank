# UI Redesign Plan

## Page Audit

### Safe Visual-First Pages
- `Home`
  Reason: mostly marketing and navigation shell.
- `FindFoodBank`
  Reason: stable search flow, clear results layout, limited write actions.
- `FoodPackages`
  Reason: card/list visual redesign is safe if selection behavior is preserved.
- `ApplicationForm`
  Reason: can redesign layout and messaging without touching payload shape.
- `DonateCash`
  Reason: mostly form presentation and feedback states.
- `DonateGoods`
  Reason: mostly form presentation and grouped item entry UI.

### Medium-Risk Pages
- `AdminFoodManagement`
  Reason: safe to redesign visually, but many actions touch real inventory/package flows.
- `AdminStatistics`
  Reason: visual redesign is safe, but data interpretation and incomplete APIs need care.

### High-Risk / Do Not Start Here
- `Supermarket`
  Reason: interaction model is still half-demo and likely to change with backend cleanup.
- `Admin`
  Reason: acts as a shell and coordination page; redesign after shared admin patterns settle.

## Design System V1
- `src/design/tokens/colors.ts`
- `src/design/tokens/spacing.ts`
- `src/design/tokens/typography.ts`
- `src/design/tokens/motion.ts`
- `src/design/foundations/theme.css`

## FindFoodBank Sample Redesign

### What Must Stay
- postcode input behavior
- `searchFoodBanks(postcode)` call
- result cards driven from `searchResults`
- online/offline application availability logic
- login gate before navigating to `/food-packages`
- Google Maps external link

### What Can Change
- hero composition
- search module layout
- input/button visual treatment
- result card layout
- badge styling
- empty state visuals
- “connected vs discovery-only” messaging treatment

### Proposed Visual Direction
- Warm civic/community tone rather than generic app dashboard
- Editorial serif headline + clean sans body
- Layered parchment/light-stone background
- Search card as a central “service desk” moment
- Result cards with stronger hierarchy:
  - name
  - distance/status
  - address
  - opening hours / note
  - primary action

### Proposed Page Sections
1. Search hero
2. Search command card
3. Results summary
4. Food bank card grid
5. Empty/discovery-only states

### UI States To Cover In Design
- initial idle
- searching
- results found
- no results
- discovery only / unavailable online
- login required

## Suggested Next Implementation Step
Use `FindFoodBank` as the first visual sample and update only:
- page CSS/module styles
- local page layout
- shared `Button` / `Badge` visual tokens if needed

Keep store, auth, routing, and API behavior unchanged.
