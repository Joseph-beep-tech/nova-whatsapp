# Admin Portal Setup Guide

## Quick Start

1. **Install Dependencies**
   ```bash
   cd admin-portal
   npm install
   ```

2. **Start Backend Server**
   Make sure your backend is running on `http://localhost:4000`
   ```bash
   cd ../backend
   npm run dev
   ```

3. **Start Admin Portal**
   ```bash
   cd admin-portal
   npm run dev
   ```

4. **Access Admin Portal**
   Open your browser to `http://localhost:3000`

## Default Login Credentials

The admin portal uses the same authentication system as the backend. You'll need to create a user account first through the backend API, or use existing credentials if you have them.

### Creating a Test Admin User

You can create a test user by making a POST request to the backend:

```bash
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@novago.com",
    "password": "admin123",
    "name": "Admin User",
    "role": "admin"
  }'
```

Or for a restaurant owner:

```bash
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "restaurant@novago.com",
    "password": "restaurant123",
    "name": "Restaurant Owner",
    "role": "restaurant_owner",
    "restaurantId": "pizza-palace"
  }'
```

## Features

### Dashboard
- View statistics: total restaurants, orders, revenue, pending orders
- Recent orders table

### Restaurants
- View all restaurants in a grid layout
- Click "View" to see restaurant details
- Click "Menu" to manage menu items
- Delete restaurants

### Menu Management
- Add new menu items with image upload
- Edit existing menu items
- Delete menu items
- Filter by category
- Vegetarian indicator

### Orders
- View all orders in a table
- Update order status
- Filter and search orders

## API Integration

The admin portal automatically proxies API requests to `http://localhost:4000` through Vite's proxy configuration. This means:

- All `/api/*` requests go to the backend
- CORS is handled automatically
- No need to configure CORS on the backend for local development

## Production Deployment

For production, update the `VITE_API_URL` environment variable:

```env
VITE_API_URL=https://api.novago.com
```

Then build:
```bash
npm run build
```

The `dist/` folder contains the production build that can be deployed to any static hosting service.

