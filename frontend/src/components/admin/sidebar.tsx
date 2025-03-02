import { sidebarLinks } from "@/lib/constants";
import { NavLink, useLocation } from "react-router";
import { useState } from "react";
import { Menu, X } from "lucide-react"; // Assuming you're using lucide-react icons

const AdminSidebar = () => {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  return (
    <>
      {/* Mobile menu button - visible only on mobile */}
      <button
        onClick={toggleMobileMenu}
        className="fixed top-4 left-4 z-30 p-2 rounded-md bg-brand-500 text-white md:hidden"
      >
        {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Sidebar - hidden on mobile by default, can be toggled */}
      <aside
        className={`w-64 bg-white border-r border-gray-100 p-4 fixed inset-y-0 left-0 z-20 transition-transform duration-300 transform ${
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        } md:translate-x-0 md:static md:block`}
      >
        {/* Header/logo */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-brand-700">Admin Panel</h2>
        </div>
        <nav>
          <ul className="flex flex-col space-y-2">
            {sidebarLinks.map(({ label, to, icon: Icon }, idx) => {
              const newLink = `/admin${to}`;
              const isActive = location.pathname === newLink;

              return (
                <li key={idx}>
                  <NavLink
                    to={`${newLink}`}
                    className={
                      "flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200 " +
                      "text-gray-700 hover:bg-brand-50 hover:text-brand-700 " +
                      (isActive
                        ? "bg-brand-100 text-brand-800 font-medium shadow-sm border-l-4 border-brand-500"
                        : "border-l-4 border-transparent")
                    }
                    onClick={() =>
                      isMobileMenuOpen && setIsMobileMenuOpen(false)
                    }
                  >
                    <Icon
                      className={`w-5 h-5 ${
                        isActive ? "text-brand-600" : "text-gray-400"
                      }`}
                    />
                    <span>{label}</span>
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>

      {/* Overlay for mobile - closes menu when clicking outside */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-10 md:hidden"
          onClick={toggleMobileMenu}
        />
      )}
    </>
  );
};

export default AdminSidebar;
