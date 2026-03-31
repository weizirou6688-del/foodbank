# FindFoodBank Figma Brief

## Goal
Redesign `FindFoodBank` into a clean product-style page using yellow and white as the primary palette.

## Hard Constraints
- No serif fonts
- No handwritten fonts
- No emoji
- No decorative sticker-style graphics
- Do not change route path, API calls, store fields, or auth gate behavior

## Visual Direction
- Primary palette: white, warm white, soft yellow, charcoal text
- Tone: clean, reliable, modern, service-oriented
- Layout: simple grid, clear hierarchy, restrained cards
- Motion: minimal, only hover and focus feedback

## Typography
- Primary font: `Inter`
- Fallbacks: `DM Sans`, `Segoe UI`, `sans-serif`
- Heading style: bold sans, tight spacing
- Body style: regular sans, high readability

## Color Tokens
- Background canvas: `#FFFBEF`
- Surface: `#FFFFFF`
- Soft surface: `#FFF8DD`
- Primary yellow: `#F4C542`
- Primary yellow hover: `#E8B92D`
- Border: `#E6D27A`
- Text primary: `#1E1E1E`
- Text secondary: `#505050`

## Page Sections
1. Header copy area
2. Search card
3. Result summary strip
4. Food bank result card grid
5. Empty state

## Food Bank Card Content
- Food bank name
- Address
- Distance badge
- Opening hours
- Online application status
- Primary action
- Google Maps link

## Required States
- Idle
- Searching
- Results found
- Discovery-only result
- No results
- Login required before continuing

## Component Mapping
- Search button -> existing `Button`
- Status badge -> existing `Badge`
- Login gate -> existing `LoginModal`
- Data source -> existing `useFoodBankStore`

## Developer Notes
- Keep `searchFoodBanks(postcode)` unchanged
- Keep `selectFoodBank(fb)` unchanged
- Keep `/food-packages` navigation unchanged
- Keep discovery-only results visible but non-actionable
