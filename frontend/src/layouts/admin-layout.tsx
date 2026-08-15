import AdminSidebar from "@/components/admin/sidebar";
import { useUser } from "@/store/user";
import { Loader } from "@mantine/core";
import { Suspense, useEffect } from "react";
import { Outlet, useNavigate } from "react-router";
import "@mantine/charts/styles.css";
import { useSocketStore } from "@/store/chat";
import { showNotification } from "@mantine/notifications";

const AdminLayout = () => {
  const { user, isLoggedIn } = useUser();
  const navigate = useNavigate();
  const { socket } = useSocketStore();

  useEffect(() => {
    if (!isLoggedIn || user?.role !== "admin") {
      navigate("/");
    }
  }, [isLoggedIn, user, navigate]);

  useEffect(() => {
    if (socket) {
      socket.on("chatRequest", (data) => {
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
    }
  }, [socket]);

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
