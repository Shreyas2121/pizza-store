import AdminSidebar from "@/components/admin/sidebar";
import { useUser } from "@/store/user";
import { Loader } from "@mantine/core";
import { Suspense, useEffect } from "react";
import { Outlet, useNavigate } from "react-router";
import '@mantine/charts/styles.css';

const AdminLayout = () => {
  const { user, isLoggedIn } = useUser();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoggedIn || user?.role !== "admin") {
      navigate("/");
    }
  }, [isLoggedIn, user, navigate]);

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
