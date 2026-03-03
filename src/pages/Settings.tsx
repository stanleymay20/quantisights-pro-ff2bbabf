import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useTheme } from "@/components/ThemeProvider";
import DashboardSidebar, { SidebarMobileToggle } from "@/components/dashboard/DashboardSidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/hooks/useOrganization";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  User, Building2, Bell, Save, Loader2, Mail, X, ScrollText, Clock, Shield, Trash2, AlertTriangle, ShieldCheck, Sun, Moon, Monitor, Activity,
} from "lucide-react";
import MFAEnroll from "@/components/auth/MFAEnroll";
import SecurityPosture from "@/components/security/SecurityPosture";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface AuditEntry {
  id: string;
  action_type: string;
  actor_type: string;
  resource_type: string;
  resource_id: string | null;
  payload: any;
  created_at: string;
}

const Settings = () => {
  const { user, signOut } = useAuth();
  const { currentOrgId, currentOrg } = useOrganization();
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [seedingDemo, setSeedingDemo] = useState(false);

  // Profile
  const [fullName, setFullName] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  // Organization
  const [orgName, setOrgName] = useState("");
  const [industry, setIndustry] = useState("");
  const [savingOrg, setSavingOrg] = useState(false);

  // Notifications
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [weeklyBrief, setWeeklyBrief] = useState(false);
  const [alertThreshold, setAlertThreshold] = useState(50);
  const [escalationThreshold, setEscalationThreshold] = useState(85);
  const [emailRecipients, setEmailRecipients] = useState<string[]>([]);
  const [emailInput, setEmailInput] = useState("");
  const [savingNotif, setSavingNotif] = useState(false);

  // Audit log
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data: profile } = await supabase.from("profiles").select("full_name").eq("user_id", user.id).maybeSingle();
      if (profile) setFullName(profile.full_name || "");
    };
    load();
  }, [user]);

  useEffect(() => {
    if (!currentOrgId) return;
    const load = async () => {
      const { data: org } = await supabase.from("organizations").select("name, industry").eq("id", currentOrgId).maybeSingle();
      if (org) { setOrgName(org.name || ""); setIndustry(org.industry || ""); }

      const { data: prefs } = await supabase.from("notification_preferences").select("*").eq("organization_id", currentOrgId).eq("role_type", "ceo").maybeSingle();
      if (prefs) {
        setEmailEnabled(prefs.email_enabled);
        setWeeklyBrief(prefs.weekly_brief_enabled);
        setAlertThreshold(prefs.alert_threshold);
        setEscalationThreshold(prefs.escalation_threshold);
        setEmailRecipients((prefs as any).email_recipients || []);
      }
    };
    load();
  }, [currentOrgId]);

  const fetchAuditLog = async () => {
    if (!currentOrgId) return;
    setLoadingAudit(true);
    const { data } = await supabase
      .from("audit_log")
      .select("*")
      .eq("organization_id", currentOrgId)
      .order("created_at", { ascending: false })
      .limit(100);
    setAuditLog((data || []) as AuditEntry[]);
    setLoadingAudit(false);
  };

  const saveProfile = async () => {
    if (!user) return;
    setSavingProfile(true);
    try {
      const { error } = await supabase.from("profiles").update({ full_name: fullName.trim().slice(0, 200) }).eq("user_id", user.id);
      if (error) throw error;
      toast({ title: "Profile updated" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setSavingProfile(false); }
  };

  const saveOrg = async () => {
    if (!currentOrgId) return;
    setSavingOrg(true);
    try {
      const trimmedName = orgName.trim().slice(0, 200);
      if (!trimmedName) throw new Error("Organization name is required");
      const { error } = await supabase.from("organizations").update({ name: trimmedName, industry: industry.trim().slice(0, 100) || null }).eq("id", currentOrgId);
      if (error) throw error;
      toast({ title: "Organization updated" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setSavingOrg(false); }
  };

  const saveNotifications = async () => {
    if (!currentOrgId) return;
    setSavingNotif(true);
    try {
      const { error } = await supabase.from("notification_preferences").upsert({
        organization_id: currentOrgId, role_type: "ceo",
        email_enabled: emailEnabled, weekly_brief_enabled: weeklyBrief,
        alert_threshold: Math.max(0, Math.min(100, alertThreshold)),
        escalation_threshold: Math.max(0, Math.min(100, escalationThreshold)),
        email_recipients: emailRecipients,
      }, { onConflict: "organization_id,role_type" });
      if (error) throw error;
      toast({ title: "Notification preferences saved" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setSavingNotif(false); }
  };

  const addRecipient = () => {
    const trimmed = emailInput.trim();
    if (trimmed && trimmed.includes("@") && !emailRecipients.includes(trimmed)) {
      setEmailRecipients(prev => [...prev, trimmed]);
      setEmailInput("");
    }
  };

  const ACTION_LABELS: Record<string, string> = {
    orchestration_run: "Orchestration Run",
    advisory_generated: "Advisory Generated",
    risk_recalculated: "Risk Recalculated",
    board_report_exported: "Board Report Exported",
    threshold_changed: "Threshold Changed",
    settings_updated: "Settings Updated",
    data_uploaded: "Data Uploaded",
    onboarding_completed: "Onboarding Completed",
  };

  return (
    <div className="flex min-h-screen bg-background">
      <DashboardSidebar />
      <div className="flex-1 flex flex-col min-h-screen">
        <header className="h-14 border-b border-border/30 flex items-center px-8 shrink-0 bg-background/60 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <SidebarMobileToggle />
            <h1 className="text-xl font-semibold font-display">Settings</h1>
          </div>
        </header>

        <main className="flex-1 p-8 overflow-auto">
          <div className="max-w-3xl mx-auto">
            <Tabs defaultValue="profile" className="space-y-6">
              <TabsList className="grid w-full grid-cols-6">
                <TabsTrigger value="profile" className="gap-2"><User className="w-4 h-4" /> Profile</TabsTrigger>
                <TabsTrigger value="appearance" className="gap-2"><Sun className="w-4 h-4" /> Appearance</TabsTrigger>
                <TabsTrigger value="security" className="gap-2"><ShieldCheck className="w-4 h-4" /> Security</TabsTrigger>
                <TabsTrigger value="organization" className="gap-2"><Building2 className="w-4 h-4" /> Organization</TabsTrigger>
                <TabsTrigger value="notifications" className="gap-2"><Bell className="w-4 h-4" /> Notifications</TabsTrigger>
                <TabsTrigger value="audit" className="gap-2" onClick={fetchAuditLog}><ScrollText className="w-4 h-4" /> Audit Log</TabsTrigger>
              </TabsList>

              {/* Profile */}
              <TabsContent value="profile">
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                  <Card>
                    <CardHeader><CardTitle className="flex items-center gap-2"><User className="w-5 h-5 text-primary" /> Profile Settings</CardTitle></CardHeader>
                    <CardContent className="space-y-6">
                      <div className="space-y-2">
                        <Label>Email</Label>
                        <Input value={user?.email || ""} disabled className="bg-muted/50" />
                        <p className="text-xs text-muted-foreground">Email cannot be changed</p>
                      </div>
                      <div className="space-y-2">
                        <Label>Full Name</Label>
                        <Input value={fullName} onChange={e => setFullName(e.target.value)} maxLength={200} placeholder="Your full name" />
                      </div>
                      <Button onClick={saveProfile} disabled={savingProfile} className="gap-2">
                        {savingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Profile
                      </Button>
                    </CardContent>
                  </Card>

                  {/* Account Deletion */}
                  <Card className="border-destructive/30 mt-6">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-destructive"><AlertTriangle className="w-5 h-5" /> Danger Zone</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-4">
                        Permanently delete your account and all associated data. This action cannot be undone. Your data will be purged per our <a href="/data-retention" className="text-primary hover:underline">Data Retention Policy</a>.
                      </p>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" className="gap-2"><Trash2 className="w-4 h-4" /> Delete Account</Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete your account?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete your profile, uploaded datasets (within 7 days), and all associated data. Audit logs are retained for 24 months per regulatory requirements. This cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              disabled={deletingAccount}
                              onClick={async () => {
                                setDeletingAccount(true);
                                try {
                                  const { error } = await supabase.functions.invoke("delete-account");
                                  if (error) throw error;
                                  await signOut();
                                  toast({ title: "Account deleted", description: "Your data has been permanently removed." });
                                } catch (err: any) {
                                  toast({ title: "Error", description: err.message, variant: "destructive" });
                                } finally {
                                  setDeletingAccount(false);
                                }
                              }}
                            >
                              {deletingAccount ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                              Yes, delete my account
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </CardContent>
                  </Card>
                </motion.div>
              </TabsContent>

              {/* Appearance */}
              <TabsContent value="appearance">
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                  <Card>
                    <CardHeader><CardTitle className="flex items-center gap-2"><Sun className="w-5 h-5 text-primary" /> Appearance</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-sm text-muted-foreground">Choose your preferred theme for the interface.</p>
                      <div className="grid grid-cols-3 gap-3">
                        {[
                          { value: "light" as const, label: "Day", icon: Sun },
                          { value: "dark" as const, label: "Night", icon: Moon },
                          { value: "system" as const, label: "System", icon: Monitor },
                        ].map(({ value, label, icon: Icon }) => (
                          <button
                            key={value}
                            onClick={() => setTheme(value)}
                            className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                              theme === value
                                ? "border-primary bg-primary/5"
                                : "border-border hover:border-primary/30"
                            }`}
                          >
                            <Icon className={`w-6 h-6 ${theme === value ? "text-primary" : "text-muted-foreground"}`} />
                            <span className={`text-sm font-medium ${theme === value ? "text-foreground" : "text-muted-foreground"}`}>{label}</span>
                          </button>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              </TabsContent>

              {/* Security */}
              <TabsContent value="security">
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                  <SecurityPosture />
                  <MFAEnroll />
                </motion.div>
              </TabsContent>

              {/* Organization */}
              <TabsContent value="organization">
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                  <Card>
                    <CardHeader><CardTitle className="flex items-center gap-2"><Building2 className="w-5 h-5 text-primary" /> Organization Settings</CardTitle></CardHeader>
                    <CardContent className="space-y-6">
                      <div className="space-y-2">
                        <Label>Organization Name</Label>
                        <Input value={orgName} onChange={e => setOrgName(e.target.value)} maxLength={200} placeholder="Organization name" />
                      </div>
                      <div className="space-y-2">
                        <Label>Industry</Label>
                        <Input value={industry} onChange={e => setIndustry(e.target.value)} maxLength={100} placeholder="e.g. SaaS, Manufacturing, Retail" />
                      </div>
                      {/* Org ID removed — technical details hidden from executive UI */}
                      <Button onClick={saveOrg} disabled={savingOrg} className="gap-2">
                        {savingOrg ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Organization
                      </Button>
                    </CardContent>
                  </Card>

                  {/* Demo Data */}
                  <Card className="mt-6 border-primary/30">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2"><Activity className="w-5 h-5 text-primary" /> Demo Environment</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-4">
                        Populate your organization with a realistic enterprise scenario — 15 months of metrics, risk indices, simulations, decisions, and advisories. This will overwrite existing demo data.
                      </p>
                      <Button
                        variant="outline"
                        disabled={seedingDemo}
                        className="gap-2"
                        onClick={async () => {
                          setSeedingDemo(true);
                          try {
                            const { data, error } = await supabase.functions.invoke("seed-demo-data");
                            if (error) throw error;
                            if (data?.error) throw new Error(data.error);
                            toast({
                              title: "Demo data loaded",
                              description: `${data.summary.metrics} metrics, ${data.summary.decisions} decisions, ${data.summary.advisories} advisories seeded.`,
                            });
                          } catch (err: any) {
                            toast({ title: "Error", description: err.message, variant: "destructive" });
                          } finally {
                            setSeedingDemo(false);
                          }
                        }}
                      >
                        {seedingDemo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
                        {seedingDemo ? "Seeding data…" : "Load Demo Scenario"}
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              </TabsContent>

              {/* Notifications */}
              <TabsContent value="notifications">
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                  <Card>
                    <CardHeader><CardTitle className="flex items-center gap-2"><Bell className="w-5 h-5 text-primary" /> Notification Preferences</CardTitle></CardHeader>
                    <CardContent className="space-y-6">
                      <div className="flex items-center justify-between">
                        <div><Label>Email Alerts</Label><p className="text-xs text-muted-foreground">Receive critical alerts via email</p></div>
                        <Switch checked={emailEnabled} onCheckedChange={setEmailEnabled} />
                      </div>
                      <div className="flex items-center justify-between">
                        <div><Label>Weekly Executive Brief</Label><p className="text-xs text-muted-foreground">Automated weekly intelligence summary</p></div>
                        <Switch checked={weeklyBrief} onCheckedChange={setWeeklyBrief} />
                      </div>
                      <div className="space-y-2">
                        <Label>Alert Threshold (Risk Score)</Label>
                        <Input type="number" min={0} max={100} value={alertThreshold} onChange={e => setAlertThreshold(Number(e.target.value))} />
                        <p className="text-xs text-muted-foreground">Trigger alerts when risk score exceeds this value</p>
                      </div>
                      <div className="space-y-2">
                        <Label>Escalation Threshold</Label>
                        <Input type="number" min={0} max={100} value={escalationThreshold} onChange={e => setEscalationThreshold(Number(e.target.value))} />
                        <p className="text-xs text-muted-foreground">Auto-escalate to board when score exceeds this value</p>
                      </div>
                      <div className="space-y-2">
                        <Label>Email Recipients</Label>
                        <div className="flex gap-2">
                          <Input value={emailInput} onChange={e => setEmailInput(e.target.value)} placeholder="Add email recipient" onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addRecipient())} />
                          <Button variant="outline" size="sm" onClick={addRecipient}><Mail className="w-4 h-4" /></Button>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {emailRecipients.map(email => (
                            <Badge key={email} variant="secondary" className="gap-1">
                              {email}
                              <button onClick={() => setEmailRecipients(prev => prev.filter(e => e !== email))}><X className="w-3 h-3" /></button>
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <Button onClick={saveNotifications} disabled={savingNotif} className="gap-2">
                        {savingNotif ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Notifications
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              </TabsContent>

              {/* Audit Log */}
              <TabsContent value="audit">
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2"><ScrollText className="w-5 h-5 text-primary" /> Enterprise Audit Log</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {loadingAudit ? (
                        <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
                      ) : auditLog.length === 0 ? (
                        <div className="py-12 text-center">
                          <Shield className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                          <h3 className="font-semibold mb-1">No Audit Events Yet</h3>
                          <p className="text-sm text-muted-foreground">System actions and changes will be logged here for compliance.</p>
                        </div>
                      ) : (
                        <div className="space-y-3 max-h-[600px] overflow-auto">
                          {auditLog.map(entry => (
                            <div key={entry.id} className="flex items-start gap-3 p-3 rounded-lg border border-border/50 bg-muted/20">
                              <Clock className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-sm font-medium">
                                    {ACTION_LABELS[entry.action_type] || entry.action_type}
                                  </span>
                                  <Badge variant="outline" className="text-xs">{entry.actor_type}</Badge>
                                  <Badge variant="secondary" className="text-xs">{entry.resource_type}</Badge>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {new Date(entry.created_at).toLocaleString()}
                                  {entry.resource_id && <span className="ml-2 font-mono">ID: {entry.resource_id.slice(0, 8)}…</span>}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Settings;
