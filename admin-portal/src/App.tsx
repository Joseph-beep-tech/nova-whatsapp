import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { authService } from './services/auth.service';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Restaurants from './pages/Restaurants';
import CreateRestaurant from './pages/CreateRestaurant';
import RestaurantDetail from './pages/RestaurantDetail';
import MenuManagement from './pages/MenuManagement';
import Orders from './pages/Orders';
import RestaurantOrders from './pages/RestaurantOrders';
import LiveTracking from './pages/LiveTracking';
import Payments from './pages/Payments';
import Riders from './pages/Riders';
import Analytics from './pages/Analytics';
import Users from './pages/Users';
import WhatsApp from './pages/WhatsApp';
import Layout from './components/Layout';

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } },
});

function PrivateRoute({ children }: { children: React.ReactNode }) {
  if (!authService.isAuthenticated()) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
            <Route index element={<Dashboard />} />
            <Route path="restaurants" element={<Restaurants />} />
            <Route path="restaurants/new" element={<CreateRestaurant />} />
            <Route path="restaurants/:id" element={<RestaurantOrders />} />
            <Route path="restaurants/:id/details" element={<RestaurantDetail />} />
            <Route path="restaurants/:id/menu" element={<MenuManagement />} />
            <Route path="orders" element={<Orders />} />
            <Route path="tracking" element={<LiveTracking />} />
            <Route path="payments" element={<Payments />} />
            <Route path="riders" element={<Riders />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="users" element={<Users />} />
            <Route path="whatsapp" element={<WhatsApp />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
