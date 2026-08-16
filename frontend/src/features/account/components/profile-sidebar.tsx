import { NavLink, useLocation, useNavigate } from "react-router";
import { ChevronDown, Box, MapPin, User } from "lucide-react";

export const accountNavLinks = [
  { label: "Account overview", to: "/profile", icon: User },
  { label: "Saved addresses", to: "/address", icon: MapPin },
  { label: "Orders", to: "/orders", icon: Box },
];

export const ProfileSidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex min-h-11 items-center gap-3 rounded-control px-3.5 text-sm font-semibold transition-colors ${isActive ? "bg-brand text-white shadow-subtle" : "text-ink-muted hover:bg-surface-muted hover:text-ink"}`;

  return (
    <>
      <div className="relative sm:hidden">
        <label htmlFor="account-section" className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-ink-muted">Account section</label>
        <select id="account-section" value={location.pathname} onChange={(event) => navigate(event.target.value)} className="min-h-12 w-full appearance-none rounded-control border border-border bg-surface px-4 pr-11 font-semibold text-ink shadow-subtle focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20">
          {accountNavLinks.map((link) => <option key={link.to} value={link.to}>{link.label}</option>)}
        </select>
        <ChevronDown className="pointer-events-none absolute bottom-3.5 right-4 text-ink-muted" size={19} aria-hidden="true" />
      </div>

      <nav className="hidden overflow-x-auto rounded-card border border-border bg-surface p-2 shadow-subtle sm:flex lg:sticky lg:top-32 lg:flex-col lg:gap-1 lg:p-3" aria-label="Account navigation">
        <p className="hidden px-3 pb-2 pt-1 text-xs font-bold uppercase tracking-[0.14em] text-ink-muted lg:block">My account</p>
        {accountNavLinks.map(({ label, to, icon: Icon }) => (
          <NavLink key={to} to={to} end className={linkClass}><Icon size={18} aria-hidden="true" /><span className="whitespace-nowrap">{label}</span></NavLink>
        ))}
      </nav>
    </>
  );
};

export default ProfileSidebar;
