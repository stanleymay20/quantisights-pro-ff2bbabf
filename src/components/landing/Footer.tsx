import logo from "@/assets/quantivis-logo.png";

const Footer = () => (
  <footer className="border-t border-border py-12">
    <div className="container mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
      <img src={logo} alt="Quantivis Global" className="h-8 w-auto opacity-70" />
      <p className="text-sm text-muted-foreground">
        © {new Date().getFullYear()} Quantivis Global. All rights reserved.
      </p>
    </div>
  </footer>
);

export default Footer;
