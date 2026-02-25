import { Link } from "react-router-dom";
import logo from "@/assets/quantivis-logo.png";

const FOOTER_SECTIONS = [
  {
    title: "Platform",
    links: [
      { label: "Dashboard", href: "#features" },
      { label: "KPI Intelligence", href: "#features" },
      { label: "Advisory Engine", href: "#features" },
      { label: "Board Reports", href: "#features" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "#about" },
      { label: "Pricing", to: "/pricing" },
      { label: "Contact", href: "#contact" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Documentation", href: "#" },
      { label: "Security", href: "#" },
      { label: "Status", href: "#" },
    ],
  },
];

const Footer = () => (
  <footer className="border-t border-border/50 pt-16 pb-8">
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
                    <a href={link.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
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
      <div className="border-t border-border/30 pt-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} Quantivis Global. All rights reserved.
        </p>
        <div className="flex items-center gap-6">
          <a href="#" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Privacy Policy</a>
          <a href="#" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Terms of Service</a>
          <a href="#" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Cookie Policy</a>
        </div>
      </div>
    </div>
  </footer>
);

export default Footer;
