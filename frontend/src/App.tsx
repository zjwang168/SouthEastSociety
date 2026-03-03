import { Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import CustomersPage from "./pages/CustomersPage";
import CustomerDetailPage from "./pages/CustomerDetailPage";
import OutstandingPage from "./pages/OutstandingPage";
import OrdersCreatePage from "./pages/OrdersCreatePage";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      <Route path="/customers" element={<CustomersPage />} />
      <Route path="/customers/:id" element={<CustomerDetailPage />} />

      <Route path="/outstanding" element={<OutstandingPage />} />

      {/* NEW */}
      <Route path="/orders/new" element={<OrdersCreatePage />} />

      <Route path="*" element={<div style={{ padding: 24 }}>Not Found</div>} />
    </Routes>
  );
}