import { Navigate } from "react-router";
import { useUser } from "@/features/auth";

export function AdminProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoggedIn } = useUser();

  if (!isLoggedIn || user?.role !== "admin") {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
