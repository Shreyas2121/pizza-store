import { ReactNode } from "react";
import { Navigate } from "react-router";
import { useUser } from "@/features/auth";
import { isPlatformAdmin, useAccessMe } from "@/features/access";
import { RouteSkeleton } from "@/shared/ui";

interface PlatformAdminProtectedRouteProps {
  children: ReactNode;
}

export const PlatformAdminProtectedRoute = ({
  children,
}: PlatformAdminProtectedRouteProps) => {
  const { isLoggedIn, user } = useUser();
  const { data: access, isLoading } = useAccessMe();

  if (!isLoggedIn || !user) {
    return <Navigate to="/" replace />;
  }

  if (isLoading) {
    return <RouteSkeleton admin />;
  }

  if (!isPlatformAdmin(access)) {
    return <Navigate to="/admin" replace />;
  }

  return <>{children}</>;
};

export default PlatformAdminProtectedRoute;
