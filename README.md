# ABC Community Food Bank

A web-based Food Bank Information Management System built with React + TypeScript.

## Tech Stack

- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite
- **UI Library**: shadcn/ui + Tailwind CSS
- **State Management**: Zustand
- **Routing**: React Router v6
- **Styling**: CSS Modules + Tailwind CSS

## Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Demo Accounts

| Role        | Email                    | Password   |
|-------------|--------------------------|------------|
| Admin       | admin@foodbank.com       | admin123   |
| Supermarket | supermarket@foodbank.com | supermarket123 |
| Public User | user@example.com         | user123    |

## Password Prompts And Where Passwords Are Stored

When the terminal asks for a password, use this mapping:

- If terminal shows `[sudo] password for codespace:`
- If terminal shows `[sudo] codespace 密码：`
- Input: `codespace`

- If terminal asks for PostgreSQL user `foodbank` password:
- Input: `foodbank`

- Frontend demo login passwords:
- See `src/data/mockData.ts` (line 5 and below)

Password and key locations in this project:

- System sudo password: not stored in project files (system account credential)
- PostgreSQL connection username/password: `.env` -> `DATABASE_URL`
- JWT signing key: `.env` -> `SECRET_KEY`
- Frontend demo account passwords: `src/data/mockData.ts`

## Project Structure

```
src/
├── assets/          # Static assets (images, fonts)
├── components/
│   ├── ui/          # Reusable UI primitives (Button, Modal, Badge…)
│   ├── layout/      # Navbar, Footer, Layout wrapper
│   └── auth/        # LoginModal, ProtectedRoute
├── pages/
│   ├── Home/
│   ├── FindFoodBank/
│   ├── FoodPackages/
│   ├── DonateCash/
│   └── DonateGoods/
├── store/           # Zustand stores (auth, foodbank)
├── data/            # Mock data
├── types/           # TypeScript interfaces
├── utils/           # Helper functions
├── router/          # Route definitions
├── App.tsx
└── main.tsx
```

## Future Plans

- [ ] Supermarket dashboard
- [ ] Admin dashboard (inventory, statistics, package management)
- [ ] Connect to FastAPI + PostgreSQL backend
- [ ] Real payment integration
