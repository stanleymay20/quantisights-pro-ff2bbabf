import { useState } from "react";
import { motion } from "framer-motion";
import { Loader2, ShieldCheck, Building2, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";

const SIZE_OPTIONS = ["1-50", "51-250", "251-1000", "1001-5000", "5000+"];

const EnterpriseContact = () => {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    work_email: "",
    company: "",
    company_size: "",
    use_case: "",
    estimated_seats: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name || !form.work_email || !form.company) {
      toast({ title: "Missing fields", description: "Name, work email and company are required.", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from("enterprise_leads").insert({
        full_name: form.full_name.trim(),
        work_email: form.work_email.trim(),
        company: form.company.trim(),
        company_size: form.company_size || null,
        use_case: form.use_case || null,
        estimated_seats: form.estimated_seats ? parseInt(form.estimated_seats, 10) : null,
        source: "web_enterprise_contact",
      });
      if (error) throw error;
      setSubmitted(true);
    } catch (err) {
      toast({
        title: "Submission failed",
        description: err instanceof Error ? err.message : "Please try again or email enterprise@quantivis.io",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-dvh bg-background flex flex-col">
      <Navbar />
      <main className="pt-32 pb-16">
        <div className="container mx-auto px-6 max-w-3xl">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-4">
              <Building2 className="w-3.5 h-3.5" /> Enterprise Sales
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold font-display mb-3">
              Talk to <span className="gradient-text">Enterprise</span>
            </h1>
            <p className="text-muted-foreground">
              For organizations needing SSO, dedicated infrastructure, custom SLAs, or 50+ seats.
              Average response time: 1 business day.
            </p>
          </motion.div>

          {submitted ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="glass-card p-10 text-center"
            >
              <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-success" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Request received</h2>
              <p className="text-muted-foreground mb-6">
                Our enterprise team will reach out within 1 business day at{" "}
                <span className="font-semibold text-foreground">{form.work_email}</span>.
              </p>
              <p className="text-xs text-muted-foreground">
                Need it sooner? Email <a href="mailto:enterprise@quantivis.io" className="text-primary hover:underline">enterprise@quantivis.io</a>
              </p>
            </motion.div>
          ) : (
            <motion.form
              onSubmit={handleSubmit}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="glass-card p-8 space-y-5"
            >
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">Full name *</label>
                  <input
                    type="text"
                    required
                    value={form.full_name}
                    onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-primary"
                    placeholder="Jane Doe"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">Work email *</label>
                  <input
                    type="email"
                    required
                    value={form.work_email}
                    onChange={(e) => setForm({ ...form, work_email: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-primary"
                    placeholder="jane@company.com"
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">Company *</label>
                  <input
                    type="text"
                    required
                    value={form.company}
                    onChange={(e) => setForm({ ...form, company: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-primary"
                    placeholder="Acme Corp"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">Company size</label>
                  <select
                    value={form.company_size}
                    onChange={(e) => setForm({ ...form, company_size: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-primary"
                  >
                    <option value="">Select…</option>
                    {SIZE_OPTIONS.map((s) => <option key={s} value={s}>{s} employees</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">Estimated seats</label>
                <input
                  type="number"
                  min="1"
                  value={form.estimated_seats}
                  onChange={(e) => setForm({ ...form, estimated_seats: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-primary"
                  placeholder="e.g. 50"
                />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">What are you trying to solve?</label>
                <textarea
                  rows={4}
                  value={form.use_case}
                  onChange={(e) => setForm({ ...form, use_case: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-primary resize-none"
                  placeholder="Briefly describe your decision intelligence needs, current tooling, and any compliance requirements (SOC2, GDPR, HIPAA…)"
                  maxLength={5000}
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:brightness-110 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</> : "Request a demo"}
              </button>

              <div className="flex items-start gap-2 pt-2 text-xs text-muted-foreground">
                <ShieldCheck className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <span>Submissions are private. We never share your details. See our <a href="/privacy" className="text-primary hover:underline">privacy policy</a>.</span>
              </div>
            </motion.form>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default EnterpriseContact;
