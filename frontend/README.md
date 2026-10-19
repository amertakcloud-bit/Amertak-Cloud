# React Dashboard Starter

A clean, beginner-friendly Vite + React dashboard starter template with a dark, glassy, purple-accented UI.

## Features

- Header with mobile menu button, language toggle, theme toggle, and profile button
- Collapsible / off-canvas Sidebar for mobile
- Sidebar dropdown / submenu (Projects → All / Active / Archived)
- React Router DOM navigation with active-link highlighting
- Dark and light theme (CSS variables, saved to `localStorage`)
- English / Khmer language toggle (saved to `localStorage`)
- Glassmorphism (blur) styling with a purple accent
- Fully responsive layout

## Tech Stack

- [Vite](https://vitejs.dev/)
- [React](https://react.dev/) (JavaScript + JSX, no TypeScript)
- [React Router DOM](https://reactrouter.com/)
- [Remix Icon](https://remixicon.com/) (CSS classes, not the React package)
- Plain CSS (no Tailwind)

## Installation

```bash
npm install
```

## Run (development)

```bash
npm run dev
```

Then open the URL shown in your terminal (usually `http://localhost:5173`).

## Build (production)

```bash
npm run build
npm run preview
```

## Folder Structure

```
src/
├── components/       Header, Sidebar, SidebarItem
├── layouts/          MainLayout (Sidebar + Header + Outlet)
├── pages/            Home, Dashboard, Projects, Settings, NotFound
├── data/             sidebarItems.js (sidebar navigation data)
├── context/          LanguageContext.jsx (EN / KM translations)
├── styles/           variables, global, layout, sidebar, header, pages
├── App.jsx           Route definitions
└── main.jsx          App entry point
```

## Documentation (Khmer)

Full step-by-step tutorials are written in Khmer inside `docs/`:

- [docs/INSTALL_KH.md](docs/INSTALL_KH.md) — ការដំឡើង និងដំណើរការគម្រោង
- [docs/CREATE_PAGE_KH.md](docs/CREATE_PAGE_KH.md) — របៀបបង្កើតទំព័រថ្មី
- [docs/ADD_SIDEBAR_ITEM_KH.md](docs/ADD_SIDEBAR_ITEM_KH.md) — របៀបបន្ថែមមុខទំព័រ Sidebar
- [docs/STYLING_KH.md](docs/STYLING_KH.md) — របៀបកែប្រែរូបរាង (CSS)
- [docs/STRUCTURE_KH.md](docs/STRUCTURE_KH.md) — ការពន្យល់រចនាសម្ព័ន្ធថតឯកសារ
