import { Navigate } from "react-router-dom";
import type { ReactElement } from "react";

export default function ProtectedRoute({
  children,
}: {
  children: ReactElement;
}) {
  const token = localStorage.getItem("access_token");

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return children;
}



