import { Link } from "react-router-dom";
import logo from "@/assets/quantivis-logo.png";

const Terms = () => (
  <div className="min-h-screen bg-background">
    <header className="border-b border-border/30 bg-background/80 backdrop-blur-sm sticky top-0 z-30">
      <div className="container mx-auto px-6 h-14 flex items-center">
        <Link to="/"><img src={logo} alt="Quantivis Global" className="h-8" /></Link>
      </div>
    </header>
    <main className="container mx-auto px-6 py-16 max-w-3xl">
      <h1 className="text-3xl font-bold font-display mb-2">Terms of Service</h1>
      <p className="text-muted-foreground text-sm mb-10">Last updated: February 25, 2026</p>

      <div className="prose prose-sm prose-invert max-w-none space-y-6 text-foreground/90 text-sm leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold mb-2">1. Acceptance of Terms</h2>
          <p>By accessing or using Quantivis Global ("the Platform"), you agree to be bound by these Terms of Service. If you do not agree, do not use the Platform.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold mb-2">2. Description of Service</h2>
          <p>Quantivis Global provides an enterprise intelligence platform for data consultancy, KPI analytics, scenario modeling, diagnostics, and advisory services. Access is subject to your subscription tier.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold mb-2">3. Account Registration</h2>
          <p>You must provide accurate information when creating an account. You are responsible for maintaining the security of your credentials and for all activity under your account.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold mb-2">4. Data Ownership</h2>
          <p>You retain all rights to the data you upload. Quantivis Global processes your data solely to provide the services you've subscribed to. We do not sell, share, or use your data for purposes outside of service delivery.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold mb-2">5. Acceptable Use</h2>
          <p>You agree not to: (a) reverse-engineer the Platform; (b) use it for unlawful purposes; (c) attempt to gain unauthorized access to other accounts or systems; (d) upload malicious files or data.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold mb-2">6. Subscription & Billing</h2>
          <p>Paid plans are billed in advance on a monthly or annual basis. Cancellations take effect at the end of the billing period. Refunds are issued at our discretion.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold mb-2">7. Limitation of Liability</h2>
          <p>Quantivis Global is provided "as is." We are not liable for any indirect, incidental, or consequential damages arising from your use of the Platform. Our total liability shall not exceed the amount you paid in the preceding 12 months.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold mb-2">8. Modifications</h2>
          <p>We may update these Terms at any time. Continued use of the Platform after changes constitutes acceptance of the revised Terms.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold mb-2">9. Contact</h2>
          <p>For questions regarding these Terms, contact us at <span className="text-primary">legal@quantivis.io</span>.</p>
        </section>
      </div>
    </main>
  </div>
);

export default Terms;
