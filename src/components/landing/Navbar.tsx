import { useState } from "react";
import { Link } from "react-router-dom";
import { Menu, X } from "lucide-react";
import logo from "@/assets/quantivis-logo.png";

const NAV_LINKS = [
  { href: "#how-it-works", label: "Platform" },
  { href: "#case-studies", label: "Case Studies" },
  { href: "#contact", label: "Contact" },
];

const Navbar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-2xl">
      <div className="container mx-auto flex items-center justify-between py-4 px-6">
        <Link to="/" className="flex items-center gap-3">
          <img src={logo} alt="Quantivis Global" className="h-10 w-auto" />
        </Link>

        {/* Desktop */}
        <div className="hidden md:flex items-center gap-8">
          {NAV_LINKS.map((link) => (
            <a key={link.label} href={link.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              {link.label}
            </a>
          ))}
          <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Sign In
          </Link>
          <Link
            to="/register"
            className="px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:brightness-110 transition-all"
          >
            Start Free Trial
          </Link>
        </div>

        {/* Mobile toggle */}
        <button className="md:hidden p-2 rounded-lg hover:bg-secondary/60 transition-colors" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-border/30 bg-background/95 backdrop-blur-xl px-6 py-4 space-y-3">
          {NAV_LINKS.map((link) => (
            <a key={link.label} href={link.href} className="block text-sm text-muted-foreground hover:text-foreground py-2" onClick={() => setMobileOpen(false)}>
              {link.label}
            </a>
          ))}
          <Link to="/login" className="block text-sm text-muted-foreground hover:text-foreground py-2" onClick={() => setMobileOpen(false)}>
            Sign In
          </Link>
          <Link
            to="/register"
            className="block text-center px-5 py-3 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:brightness-110 transition-all"
            onClick={() => setMobileOpen(false)}
          >
            Start Free Trial
          </Link>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
