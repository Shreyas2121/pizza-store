import { useState } from "react";
import { Button, Drawer } from "@mantine/core";
import { Menu, ShoppingCart, User, Truck, LogIn } from "lucide-react";
import { Link } from "react-router"; // Fixed import
import { useUser } from "../store/user";
import { useAuthModalStore } from "../store/modal";
import Login from "./auth/login";
import { success } from "../lib/utils";
import { useGetCartCount } from "../hooks/cart";

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { isLoggedIn, logout } = useUser();
  const { openModal } = useAuthModalStore();

  const { data } = useGetCartCount();

  return (
    <nav className="bg-white shadow-md p-4 flex justify-between items-center">
      {/* Logo */}
      <Link to="/" className="text-xl font-bold text-gray-900">
        PizzaStore
      </Link>

      {/* Desktop Links */}
      <div className="hidden md:flex gap-6 items-center">
        {isLoggedIn ? (
          <>
            <Link to="/cart" className="relative">
              <ShoppingCart size={24} className="hover:text-gray-700" />
              <span className="absolute -top-1 -right-2 bg-red-500 text-white text-xs rounded-full px-2">
                {data ?? 0}
              </span>
            </Link>
            <Link to="/profile">
              <User size={24} className="hover:text-gray-700" />
            </Link>
            <Button
              onClick={() => {
                logout();
                success("Logged out successfully");
              }}
            >
              Logout
            </Button>
          </>
        ) : (
          <Button
            className="bg-secondary text-white hover:bg-secondary-dark flex items-center gap-2"
            onClick={() => openModal(<Login />)}
          >
            <LogIn size={16} /> Login
          </Button>
        )}
      </div>

      {/* Mobile Menu Button */}
      <button className="md:hidden" onClick={() => setMobileOpen(true)}>
        <Menu size={24} />
      </button>

      {/* Mobile Drawer */}
      <Drawer
        opened={mobileOpen}
        onClose={() => setMobileOpen(false)}
        position="right"
        size="60%"
      >
        <div className="flex flex-col gap-4 p-4">
          {isLoggedIn ? (
            <>
              <Link to="/cart" className="flex items-center gap-2">
                <ShoppingCart size={24} /> Cart
              </Link>

              <Link to="/profile" className="flex items-center gap-2">
                <User size={24} /> Profile
              </Link>
              <Button onClick={logout}>Logout</Button>
            </>
          ) : (
            <Button
              className="bg-secondary text-white hover:bg-secondary-dark flex items-center gap-2"
              onClick={() => openModal(<Login />)}
            >
              <LogIn size={16} /> Login
            </Button>
          )}
        </div>
      </Drawer>
    </nav>
  );
}
