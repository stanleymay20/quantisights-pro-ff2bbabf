import { useState } from "react";
import { SidebarMobileToggle } from "@/components/layout/ProtectedShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useOrganization } from "@/hooks/useOrganization";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Shield, Key, Building2, CheckCircle2, AlertTriangle,
  Copy, ExternalLink, Lock, Users, FileText, Info,
} from "lucide-react";
import { motion } from "framer-motion";

const SSOConfig = () => {
  const { currentOrgId, currentOrg } = useOrganization();
  const { toast } = useToast();
  
  // SAML Config State
  const [samlEnabled, setSamlEnabled] = useState(false);
  const [idpEntityId, setIdpEntityId] = useState("");
  const [idpSsoUrl, setIdpSsoUrl] = useState("");
  const [idpCertificate, setIdpCertificate] = useState("");
  const [idpMetadataUrl, setIdpMetadataUrl] = useState("");
  const [attributeMapping, setAttributeMapping] = useState({
    email: "email",
    firstName: "first_name",
    lastName: "last_name",
    role: "role",
  });
  const [enforceSSO, setEnforceSSO] = useState(false);
  const [allowedDomains, setAllowedDomains] = useState("");
  const [saving, setSaving] = useState(false);

  // SP Metadata (for the customer to configure in their IdP)
  const spEntityId = `${window.location.origin}/auth/saml/${currentOrgId}`;
  const spAcsUrl = `${window.location.origin}/auth/saml/callback`;
  const spMetadataUrl = `${window.location.origin}/auth/saml/metadata/${currentOrgId}`;

  const handleSave = async () => {
    if (!currentOrgId) return;
    setSaving(true);
    try {
      // Store SSO config in org settings (using audit_log for now since we don't have a dedicated SSO table)
      await supabase.from("audit_log").insert({
        organization_id: currentOrgId,
        actor_type: "user",
        action_type: "sso_config_updated",
        resource_type: "organization",
        resource_id: currentOrgId,
        payload: {
          saml_enabled: samlEnabled,
          idp_entity_id: idpEntityId,
          idp_sso_url: idpSsoUrl,
          idp_metadata_url: idpMetadataUrl,
          enforce_sso: enforceSSO,
          allowed_domains: allowedDomains.split(",").map(d => d.trim()).filter(Boolean),
          attribute_mapping: attributeMapping,
          configured_at: new Date().toISOString(),
        },
      });

      toast({
        title: "SSO Configuration Saved",
        description: "SAML settings have been saved. Contact support to activate enterprise SSO.",
      });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: `${label} copied to clipboard` });
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3">
        <SidebarMobileToggle />
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary" />
            SSO / SAML Configuration
          </h1>
          <p className="text-sm text-muted-foreground">
            Enterprise Single Sign-On for your organization
          </p>
        </div>
        <Badge variant="outline" className="ml-auto bg-amber-500/10 text-amber-600 border-amber-500/20">
          Enterprise Feature
        </Badge>
      </div>

      {/* Status Banner */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4 flex items-start gap-3">
          <Info className="w-5 h-5 text-primary mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium">Enterprise SSO Readiness</p>
            <p className="text-xs text-muted-foreground mt-1">
              Configure your SAML 2.0 identity provider below. Once saved, contact your account manager 
              to activate SSO for your organization. Supported providers: Okta, Azure AD, OneLogin, Google Workspace, PingIdentity.
            </p>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="configure">
        <TabsList>
          <TabsTrigger value="configure" className="gap-1.5"><Key className="w-3.5 h-3.5" /> Configure IdP</TabsTrigger>
          <TabsTrigger value="sp-metadata" className="gap-1.5"><FileText className="w-3.5 h-3.5" /> SP Metadata</TabsTrigger>
          <TabsTrigger value="policies" className="gap-1.5"><Lock className="w-3.5 h-3.5" /> Policies</TabsTrigger>
        </TabsList>

        <TabsContent value="configure" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Identity Provider Configuration</CardTitle>
              <CardDescription>Enter your SAML 2.0 identity provider details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Switch checked={samlEnabled} onCheckedChange={setSamlEnabled} />
                <Label>Enable SAML SSO</Label>
              </div>

              <div>
                <Label>IdP Metadata URL (recommended)</Label>
                <Input 
                  value={idpMetadataUrl} 
                  onChange={e => setIdpMetadataUrl(e.target.value)}
                  placeholder="https://your-idp.com/app/metadata"
                  className="mt-1.5"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  If provided, other fields will be auto-populated from metadata.
                </p>
              </div>

              <div className="border-t pt-4">
                <p className="text-sm font-medium mb-3 text-muted-foreground">Or configure manually:</p>
                <div className="space-y-4">
                  <div>
                    <Label>IdP Entity ID (Issuer)</Label>
                    <Input 
                      value={idpEntityId}
                      onChange={e => setIdpEntityId(e.target.value)}
                      placeholder="https://your-idp.com/entity-id"
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label>IdP SSO URL</Label>
                    <Input 
                      value={idpSsoUrl}
                      onChange={e => setIdpSsoUrl(e.target.value)}
                      placeholder="https://your-idp.com/sso/saml"
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label>IdP X.509 Certificate</Label>
                    <Textarea 
                      value={idpCertificate}
                      onChange={e => setIdpCertificate(e.target.value)}
                      placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
                      className="mt-1.5 font-mono text-xs"
                      rows={6}
                    />
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                <p className="text-sm font-medium mb-3">Attribute Mapping</p>
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(attributeMapping).map(([key, value]) => (
                    <div key={key}>
                      <Label className="text-xs capitalize">{key.replace(/([A-Z])/g, " $1")}</Label>
                      <Input 
                        value={value}
                        onChange={e => setAttributeMapping(prev => ({ ...prev, [key]: e.target.value }))}
                        className="mt-1"
                        placeholder={`SAML attribute for ${key}`}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <Button onClick={handleSave} disabled={saving} className="w-full mt-4">
                {saving ? "Saving..." : "Save SSO Configuration"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sp-metadata" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Service Provider Metadata</CardTitle>
              <CardDescription>
                Provide these values to your identity provider administrator
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { label: "SP Entity ID (Audience URI)", value: spEntityId },
                { label: "Assertion Consumer Service (ACS) URL", value: spAcsUrl },
                { label: "SP Metadata URL", value: spMetadataUrl },
              ].map(({ label, value }) => (
                <div key={label} className="p-3 rounded-lg border bg-muted/30">
                  <Label className="text-xs text-muted-foreground">{label}</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="text-xs bg-background px-2 py-1 rounded border flex-1 overflow-auto">
                      {value}
                    </code>
                    <Button size="sm" variant="ghost" onClick={() => copyToClipboard(value, label)}>
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}

              <div className="p-3 rounded-lg border bg-muted/30">
                <Label className="text-xs text-muted-foreground">Name ID Format</Label>
                <code className="block text-xs mt-1">urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</code>
              </div>

              <div className="p-3 rounded-lg border bg-muted/30">
                <Label className="text-xs text-muted-foreground">Required SAML Attributes</Label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {["email (required)", "first_name", "last_name", "role"].map(attr => (
                    <code key={attr} className="text-xs bg-background px-2 py-1 rounded border">{attr}</code>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="policies" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">SSO Policies</CardTitle>
              <CardDescription>Configure enforcement and domain restrictions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div>
                  <p className="text-sm font-medium">Enforce SSO</p>
                  <p className="text-xs text-muted-foreground">
                    When enabled, email/password login is disabled. All users must authenticate via SSO.
                  </p>
                </div>
                <Switch checked={enforceSSO} onCheckedChange={setEnforceSSO} />
              </div>

              <div>
                <Label>Allowed Email Domains</Label>
                <Input 
                  value={allowedDomains}
                  onChange={e => setAllowedDomains(e.target.value)}
                  placeholder="company.com, subsidiary.com"
                  className="mt-1.5"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Comma-separated. Only users with these email domains can authenticate via SSO.
                </p>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div>
                  <p className="text-sm font-medium">Auto-Provision Users</p>
                  <p className="text-xs text-muted-foreground">
                    Automatically create accounts for new SSO users from allowed domains.
                  </p>
                </div>
                <Switch defaultChecked />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div>
                  <p className="text-sm font-medium">Deactivate on IdP Removal</p>
                  <p className="text-xs text-muted-foreground">
                    Automatically deactivate user accounts when removed from the identity provider.
                  </p>
                </div>
                <Switch defaultChecked />
              </div>

              <Button onClick={handleSave} disabled={saving} className="w-full">
                {saving ? "Saving..." : "Save Policies"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SSOConfig;
