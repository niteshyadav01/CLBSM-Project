import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import DailySales from './pages/DailySales';
import DailyStock from './pages/DailyStock';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import Items from './pages/Items';
import Login from './pages/Login';
import Reports from './pages/Reports';
import Settings from './pages/Settings';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/items" element={<Items />} />
          <Route path="/daily-stock" element={<DailyStock />} />
          <Route path="/sales" element={<DailySales />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
