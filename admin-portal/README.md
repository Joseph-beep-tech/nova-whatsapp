# NovaGo Admin Portal

A web-based admin portal for managing restaurants, menus, and orders in the NovaGo food delivery platform.

## Features

- 🔐 Authentication system for restaurant owners
- 📊 Dashboard with statistics and overview
- 🏪 Restaurant management (view, edit, delete)
- 🍽️ Menu management (add, edit, delete items with image upload)
- 📦 Order management and status updates
- 📱 Responsive design (mobile, tablet, desktop)

## Tech Stack

- **React 18** with TypeScript
- **Vite** for fast development
- **React Router** for navigation
- **React Query** for data fetching
- **Tailwind CSS** for styling
- **Axios** for API calls
- **Lucide React** for icons

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Backend server running on `http://localhost:4000`

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Open your browser to `http://localhost:3000`

### Environment Variables

Create a `.env` file in the root directory:

```env
VITE_API_URL=http://localhost:4000
```

## Project Structure

```
admin-portal/
├── src/
│   ├── components/     # Reusable components
│   ├── pages/          # Page components
│   ├── services/       # API service functions
│   ├── types/          # TypeScript type definitions
│   ├── App.tsx         # Main app component
│   └── main.tsx        # Entry point
├── public/             # Static assets
└── package.json
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Features in Detail

### Authentication
- Login with email and password
- JWT token-based authentication
- Protected routes

### Dashboard
- Total restaurants count
- Total orders count
- Total revenue
- Pending orders count
- Recent orders table

### Restaurant Management
- View all restaurants
- View restaurant details
- Edit restaurant information
- Delete restaurants
- Navigate to menu management

### Menu Management
- View all menu items for a restaurant
- Add new menu items with image upload
- Edit existing menu items
- Delete menu items
- Filter by category
- Vegetarian indicator

### Order Management
- View all orders
- Filter orders by status
- Update order status
- View order details

## API Integration

The admin portal uses the same backend API as the Flutter app:

- `/api/auth/*` - Authentication endpoints
- `/api/restaurants/*` - Restaurant endpoints
- `/api/menus/*` - Menu endpoints
- `/api/orders/*` - Order endpoints

## Building for Production

```bash
npm run build
```

The production build will be in the `dist/` directory.

## Deployment

The admin portal can be deployed to:
- Vercel
- Netlify
- AWS S3 + CloudFront
- Any static hosting service

Make sure to set the `VITE_API_URL` environment variable to your production API URL.

