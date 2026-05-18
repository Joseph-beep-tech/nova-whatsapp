# Azizi Voice AI - Frontend

Modern React frontend for the Azizi Voice AI Portal.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Set environment variables in `.env`:
```bash
REACT_APP_API_URL=http://localhost:5000/api
```

## Development

```bash
npm start
```

Opens at http://localhost:3000

## Build

```bash
npm run build
```

## Features

- **Modern UI** - Clean, intuitive interface with Tailwind CSS
- **Responsive Design** - Works on mobile, tablet, and desktop
- **User Authentication** - Secure login/register system
- **Real-time Updates** - Live data synchronization
- **Dark Mode Ready** - Built for light/dark themes
- **Accessibility** - WCAG compliant components

## Folder Structure

```
src/
├── components/      # Reusable UI components
├── pages/          # Page components
├── hooks/          # Custom React hooks
├── store/          # Zustand state management
├── utils/          # Utility functions
├── App.tsx         # Main app component
├── main.tsx        # Entry point
└── index.css       # Global styles
```

## Technologies

- React 18
- TypeScript
- Tailwind CSS
- Axios
- Zustand (State Management)
- React Hot Toast
- Lucide React Icons
- Framer Motion
- Recharts (Visualizations)
