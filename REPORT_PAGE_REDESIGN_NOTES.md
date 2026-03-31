# Foodbank Page Redesign Notes

## 1. Project Background

This round of work focused on three closely related user-facing pages:

- Homepage
- Find Food Bank
- Food Packages

The goal was not to rebuild the whole system, but to replace the front-end presentation of these pages so they matched the provided Figma/HTML references as closely as possible, while preserving the existing project structure, backend services, and database connections.

## 2. Main Design Idea

The design direction can be described as:

- cleaner and more editorial than the original implementation
- strong yellow-and-white accent system for public-facing actions
- information-first layout that reduces confusion for first-time users
- clear separation between discovery flow and application flow

The homepage was redesigned to act as a public-facing landing page instead of a utility-first dashboard. The visual hierarchy was adjusted so the user sees mission, impact, and donation/support entry points before detailed system interactions.

The Find Food Bank page was redesigned around a two-column workflow:

- left side for geographic understanding through the map
- right side for actionable results through cards, pagination, contact details, and package entry points

The Food Packages page was kept closer to the existing system behavior because it is a transactional page rather than a marketing page. The main design principle there was to preserve familiarity and reduce friction once a user enters the package selection flow.

## 3. Functional Architecture

The finished flow now works across several layers:

### Frontend UI

- `Home.tsx` provides the public landing experience and navigation entry points
- `FindFoodBank.tsx` handles postcode input, result presentation, login interception, and the bridge into package browsing
- `FoodBankMap.tsx` renders the live Leaflet map and keeps map state aligned with search results
- `FoodPackages.tsx` handles package selection and application submission

### Frontend State / Data Flow

- `foodBankStore.ts` is the central client-side state layer for food bank search, selected food bank, package loading, and application submission
- `foodbankApi.ts` contains the external search helpers for postcode lookup, GiveFood feed retrieval, radius filtering, and Trussell opening-hours enrichment

### Backend Integration

- `backend/app/modules/food_banks/router.py` now exposes helper endpoints that make the public page usable from the browser:
  - postcode geocoding
  - GiveFood feed proxy
  - Trussell opening-hours scraping proxy

### Database Integration

- the “find nearby food banks” step primarily uses external UK data sources
- the “view packages / apply for packages” step uses the project’s own backend and database
- internal food bank records are matched against external results so the public locator can still lead into database-backed package data

## 4. What Worked Well

### 4.1 Clearer Public Entry Flow

Compared with the earlier version, the new homepage is much more suitable as a public-facing system entrance. It communicates purpose, impact, and action paths more clearly.

### 4.2 Better Information Density on the Locator Page

The food bank cards now expose more useful information in one place:

- address
- distance
- opening-hours row when available
- phone or email
- package entry button
- official website link

This reduces the number of clicks needed to decide which location is useful.

### 4.3 Stronger Real-World Search Coverage

Using `postcodes.io` and the GiveFood UK feed significantly improves the practical usefulness of the search flow, because the internal database alone does not contain enough public-facing UK food bank locations.

### 4.4 Separation of Concerns

The implementation keeps responsibilities reasonably clear:

- visual pages are responsible for layout and interaction
- the store coordinates search and state transitions
- API helper functions isolate external data logic
- backend router isolates browser-safe proxy behavior

This is useful for future maintenance and report justification.

## 5. Problems Encountered

### 5.1 Matching “Exact HTML Design” Without Breaking Existing Logic

A major challenge was that the user wanted the page to look exactly like the provided HTML, but the project already had real routing, login, package, and backend logic. A pure visual copy would have broken the existing behavior. The solution was to reproduce the layout while reattaching the original application logic behind the new UI.

### 5.2 External API Reliability

The locator flow depended on public external services. Several issues appeared during integration:

- old GiveFood endpoint paths had changed
- some upstream requests behaved differently when called from browser vs backend
- backend proxy requests required a `User-Agent`
- postcode and food bank data had to be normalized before use

This made “the API is connected” more complicated than simply calling one URL.

### 5.3 Distance Filtering Expectations

Users often expect “nearby” to behave more flexibly than strict radius math. During testing, some postcodes returned no results within 2 km even though there were clearly food banks slightly outside that limit. This required revisiting the product rule and clarifying whether “strict radius” or “best nearby fallback” was the better experience.

### 5.4 Data Model Gaps Between External and Internal Sources

The external food bank feed and the project database do not share a single guaranteed identifier. Matching had to be done using normalized names and addresses, which is useful but imperfect. This is one of the most important system limitations to mention in a report.

### 5.5 Opening-Hours Extraction

Opening hours were not consistently available in a clean JSON API format. For Trussell-linked locations, the system had to fetch and parse HTML from official `foodbank.org.uk` pages. This worked, but it is more fragile than consuming a structured API.

### 5.6 UI Layering Issues

Leaflet map controls use their own stacking behavior, which caused the map to appear above modal dialogs. This had to be fixed explicitly using z-index rules in both modal components and global CSS.

## 6. What Is Good About the Final Solution

- Keeps existing backend and database flows alive
- Improves public usability
- Supports real UK postcode search
- Supports real nearby food bank discovery
- Preserves login-protected package application flow
- Uses fallback and proxy strategies to improve reliability
- Keeps the redesign mostly isolated to page-level UI and integration helpers

## 7. What Is Not Ideal

- External and internal food bank data are still joined heuristically rather than by a stable shared ID
- Some opening-hours data depends on HTML scraping, which is less robust than a formal API
- The locator page now combines several responsibilities, so future refactoring may be needed
- Build output still shows a chunk-size warning, which suggests future frontend optimization work
- The project worktree contains unrelated local changes outside this page-redesign scope, which is a maintenance risk if not cleaned later

## 8. Key Technical Difficulties

The main technical difficulties worth discussing in a formal report are:

1. Translating a static Figma/HTML reference into a live page without losing existing application behavior.
2. Combining external public food bank data with internal package data.
3. Handling inconsistent external data quality, especially coordinates and opening hours.
4. Preserving route protection and authentication behavior after redesigning UI entry points.
5. Managing map state, card state, selected markers, and pagination together in one page.

## 9. Important Implementation Decisions

### Decision 1: Keep External Search and Internal Packages Separate

This was the correct architectural choice because:

- external sources are better for broad UK discovery
- internal database is better for system-controlled package workflows

### Decision 2: Use the Store as the Orchestrator

Placing search orchestration in `foodBankStore.ts` made it easier to:

- keep UI components simpler
- centralize matching logic
- reuse selected food bank state across pages

### Decision 3: Use Backend Proxy Endpoints for Some Public Data

This reduced browser-side problems such as:

- CORS restrictions
- upstream request blocking
- fragile direct client fetch behavior

## 10. Suggested Future Improvements

- Add a persistent mapping table between external food bank sources and internal food bank records
- Cache Trussell opening hours server-side with expiry
- Add filter controls such as “has packages available” or “open today”
- Add loading skeletons and more explicit failure states on the locator page
- Split the current large locator/store logic into smaller hooks or service modules
- Clean the repository worktree and remove unrelated generated/log files from version-control workflows

## 11. Short Reflection Paragraph

This redesign demonstrates the difference between static interface replication and real system integration. The difficult part was not only making the pages look correct, but ensuring that postcode search, external data retrieval, authentication, route protection, database-backed package loading, and modal behavior still worked together after the redesign. The final result is stronger as a user-facing product, but it also exposed architectural issues such as data-source inconsistency and reliance on external service behavior.
