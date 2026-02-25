import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
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
  User, Building2, Bell, Shield, Save, Loader2, Mail, X,
} from "lucide-react";

const Settings = () => {
  const { user } = useAuth();
  const { currentOrgId, currentOrg } = useOrganization();
  const { toast } = useToast();

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

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", user.id)
        .maybeSingle();
      if (profile) setFullName(profile.full_name || "");
    };
    load();
  }, [user]);

  useEffect(() => {
    if (!currentOrgId) return;
    const load = async () => {
      const { data: org } = await supabase
        .from("organizations")
        .select("name, industry")
        .eq("id", currentOrgId)
        .maybeSingle();
      if (org) {
        setOrgName(org.name || "");
        setIndustry(org.industry || "");
      }

      // Load notification prefs (use ceo as default role)
      const { data: prefs } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("organization_id", currentOrgId)
        .eq("role_type", "ceo")
        .maybeSingle();
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

  const saveProfile = async () => {
    if (!user) return;
    setSavingProfile(true);
    try {
      const trimmed = fullName.trim().slice(0, 200);
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: trimmed })
        .eq("user_id", user.id);
      if (error) throw error;
      toast({ title: "Profile updated" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSavingProfile(false);
    }
  };

  const saveOrg = async () => {
    if (!currentOrgId) return;
    setSavingOrg(true);
    try {
      const trimmedName = orgName.trim().slice(0, 200);
      if (!trimmedName) throw new Error("Organization name is required");
      const { error } = await supabase
        .from("organizations")
        .update({ name: trimmedName, industry: industry.trim().slice(0, 100) || null })
        .eq("id", currentOrgId);
      if (error) throw error;
      toast({ title: "Organization updated" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSavingOrg(false);
    }
  };

  const saveNotifications = async () => {
    if (!currentOrgId) return;
    setSavingNotif(true);
    try {
      const { error } = await supabase
        .from("notification_preferences")
        .upsert({
          organization_id: currentOrgId,
          role_type: "ceo",
          email_enabled: emailEnabled,
          weekly_brief_enabled: weeklyBrief,
          alert_threshold: Math.max(0, Math.min(100, alertThreshold)),
          escalation_threshold: Math.max(0, Math.min(100, escalationThreshold)),
          email_recipients: emailRecipients,
        }, { onConflict: "organization_id,role_type" });
      if (error) throw error;
      toast({ title: "Notification preferences saved" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSavingNotif(false);
    }
  };

  const addRecipient = () => {
    const trimmed = emailInput.trim();
    if (trimmed && trimmed.includes("@") && !emailRecipients.includes(trimmed)) {
      setEmailRecipients(prev => [...prev, trimmed]);
      setEmailInput("");
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      <DashboardSidebar />
      <div className="flex-1 flex flex-col min-h-screen">
        <header className="h-16 border-b border-border flex items-center px-8 shrink-0">
          <h1 className="text-xl font-semibold font-display">Settings</h1>
        </header>

        <main className="flex-1 p-8 overflow-auto">
          <div className="max-w-3xl mx-auto">
            <Tabs defaultValue="profile" className="space-y-6">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="profile" className="gap-2">
                  <User className="w-4 h-4" /> Profile
                </TabsTrigger>
                <TabsTrigger value="organization" className="gap-2">
                  <Building2 className="w-4 h-4" /> Organization
                </TabsTrigger>
                <TabsTrigger value="notifications" className="gap-2">
                  <Bell className="w-4 h-4" /> Notifications
                </TabsTrigger>
              </TabsList>

              {/* Profile */}
              <TabsContent value="profile">
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <User className="w-5 h-5 text-primary" /> Profile Settings
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="space-y-2">
                        <Label>Email</Label>
                        <Input value={user?.email || ""} disabled className="bg-muted/50" />
                        <p className="text-xs text-muted-foreground">Email cannot be changed</p>
                      </div>
                      <div className="space-y-2">
                        <Label>Full Name</Label>
                        <Input
                          value={fullName}
                          onChange={e => setFullName(e.target.value)}
                          maxLength={200}
                          placeholder="Your full name"
                        />
                      </div>
                      <Button onClick={saveProfile} disabled={savingProfile} className="gap-2">
                        {savingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Save Profile
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              </TabsContent>

              {/* Organization */}
              <TabsContent value="organization">
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Building2 className="w-5 h-5 text-primary" /> Organization Settings
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="space-y-2">
                        <Label>Organization Name</Label>
                        <Input
                          value={orgName}
                          onChange={e => setOrgName(e.target.value)}
                          maxLength={200}
                          placeholder="Organization name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Industry</Label>
                        <Input
                          value={industry}
                          onChange={e => setIndustry(e.target.value)}
                          maxLength={100}
                          placeholder="e.g. SaaS, Manufacturing, Retail"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Organization ID</Label>
                        <Input value={currentOrgId || ""} disabled className="bg-muted/50 font-mono text-xs" />
                      </div>
                      <Button onClick={saveOrg} disabled={savingOrg} className="gap-2">
                        {savingOrg ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Save Organization
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              </TabsContent>

              {/* Notifications */}
              <TabsContent value="notifications">
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Bell className="w-5 h-5 text-primary" /> Notification Preferences
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Email Alerts</Label>
                          <p className="text-xs text-muted-foreground">Receive critical alerts via email</p>
                        </div>
                        <Switch checked={emailEnabled} onCheckedChange={setEmailEnabled} />
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Weekly Executive Brief</Label>
                          <p className="text-xs text-muted-foreground">Automated weekly intelligence summary</p>
                        </div>
                        <Switch checked={weeklyBrief} onCheckedChange={setWeeklyBrief} />
                      </div>

                      <div className="space-y-2">
                        <Label>Alert Threshold (Risk Score)</Label>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={alertThreshold}
                          onChange={e => setAlertThreshold(Number(e.target.value))}
                        />
                        <p className="text-xs text-muted-foreground">Trigger alerts when risk score exceeds this value</p>
                      </div>

                      <div className="space-y-2">
                        <Label>Escalation Threshold</Label>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={escalationThreshold}
                          onChange={e => setEscalationThreshold(Number(e.target.value))}
                        />
                        <p className="text-xs text-muted-foreground">Auto-escalate to board when score exceeds this value</p>
                      </div>

                      <div className="space-y-2">
                        <Label>Email Recipients</Label>
                        <div className="flex gap-2">
                          <Input
                            value={emailInput}
                            onChange={e => setEmailInput(e.target.value)}
                            placeholder="Add email recipient"
                            onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addRecipient())}
                          />
                          <Button variant="outline" size="sm" onClick={addRecipient}>
                            <Mail className="w-4 h-4" />
                          </Button>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {emailRecipients.map(email => (
                            <Badge key={email} variant="secondary" className="gap-1">
                              {email}
                              <button onClick={() => setEmailRecipients(prev => prev.filter(e => e !== email))}>
                                <X className="w-3 h-3" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                      </div>

                      <Button onClick={saveNotifications} disabled={savingNotif} className="gap-2">
                        {savingNotif ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Save Notifications
                      </Button>
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
