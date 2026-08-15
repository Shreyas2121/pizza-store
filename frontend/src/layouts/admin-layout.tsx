import AdminSidebar from "@/components/admin/sidebar";
import { useUser } from "@/store/user";
import { Loader } from "@mantine/core";
import { Suspense, useEffect } from "react";
import { Outlet, useNavigate, Navigate } from "react-router";
import "@mantine/charts/styles.css";
import { useSocketStore } from "@/store/chat";
import { showNotification } from "@mantine/notifications";

const AdminLayout = () => {
  const { user, isLoggedIn } = useUser();
  const navigate = useNavigate();
  const { socket } = useSocketStore();

  if (!isLoggedIn || user?.role !== "admin") {
    return <Navigate to="/" replace />;
  }

  useEffect(() => {
    if (socket) {
      socket.on("chatRequest", () => {
        showNotification({
          title: "New Chat Request",
          message: `New Chat Request`,
          color: "blue",
          autoClose: 10000,
          onClick: () => {
            navigate(`/admin/support`);
          },
        });
      });

      return () => {
        socket.off("chatRequest");
      };
    }
  }, [socket, navigate]);

  return (
    <div>
      <div className="flex min-h-screen bg-gray-50">
        <AdminSidebar />
        <main className="flex-1 p-4 bg-gray-50">
          <Suspense fallback={<Loader />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
