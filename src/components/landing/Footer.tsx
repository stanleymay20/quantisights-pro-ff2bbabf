import { forwardRef } from "react";
import { Link } from "react-router-dom";
import logo from "@/assets/quantivis-logo.png";

const FOOTER_SECTIONS = [
  {
    title: "Platform",
    links: [
      { label: "How It Works", href: "#how-it-works" },
      { label: "Capabilities", href: "#features" },
      { label: "Case Studies", href: "#case-studies" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "Pricing", to: "/pricing" },
      { label: "Contact", href: "#contact" },
    ],
  },
  {
    title: "Legal & Compliance",
    links: [
      { label: "Privacy Policy", to: "/privacy" },
      { label: "Terms of Service", to: "/terms" },
      { label: "Cookie Policy", to: "/cookies" },
      { label: "DPA", to: "/dpa" },
      { label: "Data Retention", to: "/data-retention" },
      { label: "Subprocessors", to: "/subprocessors" },
    ],
  },
];

const Footer = forwardRef<HTMLElement>((_, ref) => (
  <footer ref={ref} role="contentinfo" className="border-t border-border pt-16 pb-8 bg-card/30">
    <div className="container mx-auto px-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
        {/* Brand */}
        <div className="col-span-2 md:col-span-1">
          <img src={logo} alt="Quantivis Global" className="h-8 w-auto mb-4" />
          <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
            Enterprise intelligence platform transforming operational data into strategic clarity.
          </p>
        </div>

        {/* Links */}
        {FOOTER_SECTIONS.map((section) => (
          <div key={section.title}>
            <h4 className="text-sm font-semibold mb-4">{section.title}</h4>
            <ul className="space-y-2.5">
              {section.links.map((link) => (
                <li key={link.label}>
                  {"to" in link && link.to ? (
                    <Link to={link.to} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                      {link.label}
                    </Link>
                  ) : (
                    <a href={(link as any).href} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                      {link.label}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Bottom bar */}
      <div className="border-t border-border pt-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} Quantivis Global. All rights reserved.
        </p>
        <div className="flex items-center gap-6">
          <Link to="/privacy" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Privacy</Link>
          <Link to="/terms" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Terms</Link>
          <Link to="/cookies" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Cookies</Link>
          <Link to="/dpa" className="text-xs text-muted-foreground hover:text-foreground transition-colors">DPA</Link>
        </div>
      </div>
    </div>
  </footer>
));

Footer.displayName = "Footer";

export default Footer;
