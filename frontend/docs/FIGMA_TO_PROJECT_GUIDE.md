# Figma -> Current Project Guide

## Goal
Redesign the UI without breaking frontend/backend/database integration.

## Never Change During Visual Redesign
- API paths
- request payload field names
- response mapping contracts
- Zustand store shape
- route paths
- auth flow and token refresh behavior
- database-driven enums and IDs

## Safe To Change
- layout
- spacing
- card structure
- typography
- color system
- iconography
- empty/loading/error presentation
- modal styling
- navigation styling

## Figma File Structure
- `Foundations / Colors`
- `Foundations / Typography`
- `Foundations / Spacing`
- `Components / Button`
- `Components / Input`
- `Components / Badge`
- `Components / Modal`
- `Components / Banner`
- `Patterns / Search Hero`
- `Patterns / Result Card`
- `Pages / Find Food Bank`

## Naming Rules
- Match component names to project vocabulary.
- Prefer names like `Button/Primary`, `Badge/Status`, `Card/FoodBank`, `Banner/Inline`.
- Avoid vague names like `Card 12`, `Section Copy`, `Frame 98`.

## Implementation Rules
- Figma is the visual source, not the code source.
- Do not paste generated Figma code into the repo as-is.
- Rebuild visuals with existing React components and app state.
- Keep container logic and data loading in page/store files.
- Move only presentational patterns into reusable UI/components.

## Page Handoff Checklist
- What store fields does the page read?
- What API calls does the page trigger?
- What route does it navigate to?
- What UI states exist: idle/loading/success/error/empty?
- Which parts are visual-only and safe to redesign?
- Which actions are business-critical and must stay intact?

## Review Checklist Before Merge
- Same route path
- Same request payloads
- Same success/failure behaviors
- Same button intents
- Same navigation outcome
- Same auth gate behavior
- No new hardcoded mock data

## Recommended Delivery Pattern
1. Build design tokens first.
2. Rework shared UI components second.
3. Restyle one sample page.
4. Validate behavior.
5. Expand to the next page.
