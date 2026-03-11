import { Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import RoleProtectedRoute from "./components/RoleProtectedRoute";

import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import CustomersPage from "./pages/CustomersPage";
import CustomerDetailPage from "./pages/CustomerDetailPage";
import OutstandingPage from "./pages/OutstandingPage";
import OrdersCreatePage from "./pages/OrdersCreatePage";
import SmsQueuePage from "./pages/SmsQueuePage";
import ExportPage from "./pages/ExportPage";
import AuditPage from "./pages/AuditPage";
import ChangePasswordPage from "./pages/ChangePasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      {/* Everyone with token */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/export"
        element={
          <ProtectedRoute>
            <ExportPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/change-password"
        element={
          <ProtectedRoute>
            <ChangePasswordPage />
          </ProtectedRoute>
        }
      />

      {/* Admin only */}
      <Route
        path="/customers"
        element={
          <RoleProtectedRoute allowed={["admin"]}>
            <CustomersPage />
          </RoleProtectedRoute>
        }
      />

      <Route
        path="/customers/:id"
        element={
          <RoleProtectedRoute allowed={["admin"]}>
            <CustomerDetailPage />
          </RoleProtectedRoute>
        }
      />

      <Route
        path="/outstanding"
        element={
          <RoleProtectedRoute allowed={["admin"]}>
            <OutstandingPage />
          </RoleProtectedRoute>
        }
      />

      <Route
        path="/orders/new"
        element={
          <RoleProtectedRoute allowed={["admin"]}>
            <OrdersCreatePage />
          </RoleProtectedRoute>
        }
      />

      <Route
        path="/sms"
        element={
          <RoleProtectedRoute allowed={["admin"]}>
            <SmsQueuePage />
          </RoleProtectedRoute>
        }
      />

      <Route
        path="/audit"
        element={
          <RoleProtectedRoute allowed={["admin"]}>
            <AuditPage />
          </RoleProtectedRoute>
        }
      />

      <Route
        path="/reset-password"
        element={
          <RoleProtectedRoute allowed={["admin"]}>
            <ResetPasswordPage />
          </RoleProtectedRoute>
        }
      />

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<div style={{ padding: 24 }}>Not Found</div>} />
    </Routes>
  );
}