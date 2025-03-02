import { NavLink } from "react-router";
import { navLinks } from "../../../lib/constants";

const ProfileSidebar = () => {
  return (
    <aside className="w-[220px] bg-white border-r border-gray-200 p-4 flex flex-col">
      <h2 className="text-xl font-semibold mb-4 text-gray-800">My Account</h2>
      <nav>
        <ul className="flex flex-col space-y-2">
          {navLinks.map(({ label, to, icon: Icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                className={({ isActive }) =>
                  [
                    "flex items-center gap-2 px-3 py-2 rounded-md transition-colors",
                    "text-gray-700 hover:bg-brand-50 hover:text-brand-800",
                    // Active link styling
                    isActive ? "bg-brand-100 text-brand-800 font-semibold" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")
                }
              >
                <Icon size={18} />
                <span>{label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
};

export default ProfileSidebar;
