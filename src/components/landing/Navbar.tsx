import { useState, forwardRef } from "react";
import { Link } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import logo from "@/assets/quantivis-logo.png";

const NAV_LINKS: { label: string; href?: string; to?: string }[] = [
  { href: "#product-preview", label: "Product" },
  { href: "#how-it-works", label: "Platform" },
  { href: "#case-studies", label: "Customers" },
  { to: "/pricing", label: "Pricing" },
  { href: "#contact", label: "Contact" },
];

const NavItem = forwardRef<HTMLAnchorElement, { link: typeof NAV_LINKS[number]; onClick?: () => void }>(({ link, onClick }, ref) => {
  const className = "text-sm text-muted-foreground hover:text-foreground transition-colors";
  if (link.to) {
    return <Link to={link.to} className={className} onClick={onClick} ref={ref}>{link.label}</Link>;
  }
  return <a href={link.href} className={className} onClick={onClick} ref={ref}>{link.label}</a>;
});
NavItem.displayName = "NavItem";

const Navbar = forwardRef<HTMLElement>((_, ref) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user } = useAuth();

  return (
    <nav ref={ref} aria-label="Main navigation" className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-2xl">
      <div className="container mx-auto flex items-center justify-between py-4 px-6">
        <Link to="/" className="flex items-center gap-3">
          <img src={logo} alt="Quantivis Global" className="h-10 w-auto" />
        </Link>

        {/* Desktop */}
        <div className="hidden md:flex items-center gap-8">
          {NAV_LINKS.map((link) => (
            <NavItem key={link.label} link={link} />
          ))}
          {user ? (
            <Link
              to="/dashboard"
              className="px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:brightness-110 transition-all"
            >
              Go to Dashboard
            </Link>
          ) : (
            <>
              <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Sign In
              </Link>
              <Link to="/demo" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Try Demo
              </Link>
              <Link
                to="/register"
                className="px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:brightness-110 transition-all"
              >
                Start Free Trial
              </Link>
            </>
          )}
        </div>

        {/* Mobile toggle */}
        <button className="md:hidden p-2 rounded-lg hover:bg-secondary/60 transition-colors" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      <div
        className={`md:hidden border-t border-border/30 bg-background/95 backdrop-blur-xl overflow-hidden transition-all duration-300 ease-in-out ${
          mobileOpen ? "max-h-[400px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="px-6 py-4 space-y-3">
          {NAV_LINKS.map((link) => (
            <div key={link.label} className="py-2">
              <NavItem link={link} onClick={() => setMobileOpen(false)} />
            </div>
          ))}
          {user ? (
            <Link
              to="/dashboard"
              className="block text-center px-5 py-3 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:brightness-110 transition-all"
              onClick={() => setMobileOpen(false)}
            >
              Go to Dashboard
            </Link>
          ) : (
            <>
              <Link to="/demo" className="block text-sm text-primary font-semibold hover:text-foreground py-2" onClick={() => setMobileOpen(false)}>
                Try Demo
              </Link>
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
            </>
          )}
        </div>
      </div>
    </nav>
  );
});

Navbar.displayName = "Navbar";

export default Navbar;
