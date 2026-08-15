import { Outlet } from "react-router";
import ProfileSidebar from "../components/main/profile/profile-sidebar";

const ProfileLayout = () => {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <ProfileSidebar />
      <main className="flex-1 p-4 bg-gray-50">
        <Outlet />
      </main>
    </div>
  );
};

export default ProfileLayout;
