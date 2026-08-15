import { Link } from "react-router";
import { Facebook, Instagram, Twitter } from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-gray-100 text-gray-700 mt-10">
      <div className="container mx-auto px-6 py-8 md:flex md:justify-between">
        {/* Brand & About */}
        <div className="mb-6 md:mb-0">
          <h2 className="text-xl font-bold text-gray-900">PizzaStore</h2>
          <p className="mt-2 text-sm">Delicious pizzas, made fresh for you!</p>
        </div>

        {/* Quick Links */}
        <div className="grid grid-cols-2 md:flex gap-6">
          <Link to="/" className="hover:text-primary transition">
            Home
          </Link>
          <Link to="/cart" className="hover:text-primary transition">
            Cart
          </Link>
          <Link to="/profile" className="hover:text-primary transition">
            Profile
          </Link>
          <Link to="/contact" className="hover:text-primary transition">
            Contact
          </Link>
        </div>

        {/* Contact & Socials */}
        <div className="mt-6 md:mt-0 text-sm">
          <p>Email: support@pizzastore.com</p>
          <p>Phone: +91 98765 43210</p>
          <div className="flex gap-4 mt-2">
            <a href="#" className="hover:text-primary transition">
              <Facebook size={20} />
            </a>
            <a href="#" className="hover:text-primary transition">
              <Instagram size={20} />
            </a>
            <a href="#" className="hover:text-primary transition">
              <Twitter size={20} />
            </a>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t text-center py-3 text-xs bg-gray-200">
        © {new Date().getFullYear()} PizzaStore. All rights reserved.
      </div>
    </footer>
  );
}
