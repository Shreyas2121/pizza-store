import { ReactNode } from "react";
import { Navigate } from "react-router";
import { useUser } from "@/features/auth";
import {
  hasStorePermission,
  isPlatformAdmin,
  useAccessMe,
  useStaffActiveStore,
} from "@/features/access";
import { RouteSkeleton } from "@/shared/ui";

interface StaffProtectedRouteProps {
  children: ReactNode;
  requiredPermission?: string;
}

export const StaffProtectedRoute = ({
  children,
  requiredPermission,
}: StaffProtectedRouteProps) => {
  const { isLoggedIn, user } = useUser();
  const { data: access, isLoading } = useAccessMe();
  const { activeStoreId } = useStaffActiveStore();

  if (!isLoggedIn || !user) {
    return <Navigate to="/" replace />;
  }

  if (isLoading) {
    return <RouteSkeleton admin />;
  }

  if (!access) {
    return <Navigate to="/" replace />;
  }

  const isStaffOrAdmin =
    isPlatformAdmin(access) || access.memberships.length > 0;

  if (!isStaffOrAdmin) {
    return <Navigate to="/" replace />;
  }

  if (requiredPermission && !isPlatformAdmin(access)) {
    const hasPerm = hasStorePermission(access, activeStoreId, requiredPermission);
    if (!hasPerm) {
      return <Navigate to="/admin" replace />;
    }
  }

  return <>{children}</>;
};

export default StaffProtectedRoute;
