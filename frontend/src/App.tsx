import { Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";

import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import CustomersPage from "./pages/CustomersPage";
import CustomerDetailPage from "./pages/CustomerDetailPage";
import OutstandingPage from "./pages/OutstandingPage";
import OrdersCreatePage from "./pages/OrdersCreatePage";
import SmsQueuePage from "./pages/SmsQueuePage";
import ExportPage from "./pages/ExportPage";

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<LoginPage />} />

      {/* Protected */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/customers"
        element={
          <ProtectedRoute>
            <CustomersPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/customers/:id"
        element={
          <ProtectedRoute>
            <CustomerDetailPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/outstanding"
        element={
          <ProtectedRoute>
            <OutstandingPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/orders/new"
        element={
          <ProtectedRoute>
            <OrdersCreatePage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/sms"
        element={
          <ProtectedRoute>
            <SmsQueuePage />
          </ProtectedRoute>
        }
      />

      {/* NEW */}
      <Route
        path="/export"
        element={
          <ProtectedRoute>
            <ExportPage />
          </ProtectedRoute>
        }
      />

      {/* Root */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      <Route path="*" element={<div style={{ padding: 24 }}>Not Found</div>} />
    </Routes>
  );
}