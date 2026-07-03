import { Navigate, Outlet } from "react-router-dom";
import { useIsAuthenticated } from "@/stores/authStore";

export function AuthGuard() {
  const isAuthenticated = useIsAuthenticated();
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
}
