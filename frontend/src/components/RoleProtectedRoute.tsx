import { Navigate } from "react-router-dom";
import type { ReactElement } from "react";

export default function RoleProtectedRoute({
  children,
  allowed,
}: {
  children: ReactElement;
  allowed: string[];
}) {
  const token = localStorage.getItem("access_token");
  const role = localStorage.getItem("user_role");

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (!role || !allowed.includes(role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}