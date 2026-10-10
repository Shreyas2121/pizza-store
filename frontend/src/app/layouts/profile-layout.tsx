import { Outlet } from "react-router";
import { Avatar } from "@mantine/core";
import { ShieldCheck } from "lucide-react";
import { ProfileSidebar } from "@/features/account";
import { useUser } from "@/features/auth";
import { Suspense } from "react";
import { RouteSkeleton } from "@/shared/ui";

export const ProfileLayout = () => {
  const { user } = useUser();
  const initials = `${user?.fname?.[0] ?? ""}${user?.lname?.[0] ?? ""}`.toUpperCase();

  return (
    <div className="page-shell py-6 sm:py-8 lg:py-10">
      <section
        className="relative overflow-hidden rounded-panel bg-ink px-5 py-6 text-white shadow-panel sm:px-7 sm:py-7"
        aria-labelledby="account-shell-title"
      >
        <div
          className="absolute -right-12 -top-16 h-52 w-52 rounded-full bg-brand/25 blur-2xl"
          aria-hidden="true"
        />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <Avatar color="brand" radius="xl" size={64} className="shrink-0 border-2 border-white/20">
              {initials}
            </Avatar>
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#F2C36E]">Your PizzaStore</p>
              <h1 id="account-shell-title" className="mt-1 truncate font-display text-3xl sm:text-4xl">
                Welcome, {user?.fname}
              </h1>
              <p className="mt-1 truncate text-sm text-white/65">{user?.email}</p>
            </div>
          </div>
          <div className="inline-flex w-fit items-center gap-2 rounded-pill border border-white/15 bg-white/10 px-3 py-2 text-xs font-semibold text-white/80">
            <ShieldCheck size={16} className="text-[#F2C36E]" aria-hidden="true" /> Secure account
          </div>
        </div>
      </section>

      <div className="mt-6 lg:grid lg:grid-cols-[240px_minmax(0,1fr)] lg:items-start lg:gap-7">
        <ProfileSidebar />
        <div className="mt-5 min-w-0 lg:mt-0">
          <Suspense fallback={<RouteSkeleton contained />}>
            <Outlet />
          </Suspense>
        </div>
      </div>
    </div>
  );
};

export default ProfileLayout;
