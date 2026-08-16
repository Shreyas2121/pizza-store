import { useEffect } from "react";
import { Login, useUser } from "@/features/auth";
import { useAuthModalStore } from "@/shared/model";

export function ProtectedRoutes({ children }: { children: React.ReactNode }) {
  const { openModal } = useAuthModalStore();
  const { isLoggedIn } = useUser();

  useEffect(() => {
    if (!isLoggedIn) {
      openModal({ content: <Login />, title: "", options: { size: 440, padding: "lg", radius: "lg" } });
    }
  }, [isLoggedIn, openModal]);

  if (!isLoggedIn) {
    return null;
  }

  return <>{children}</>;
}
