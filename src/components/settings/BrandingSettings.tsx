import { useState, useEffect } from "react";
import { useOrgBranding } from "@/hooks/useOrgBranding";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Palette, Globe, Image } from "lucide-react";

export const BrandingSettings = () => {
  const { branding, isLoading, saveBranding } = useOrgBranding();
  const [form, setForm] = useState({
    company_name: "",
    primary_color: "246 59% 50%",
    accent_color: "263 70% 50%",
    logo_url: "",
    favicon_url: "",
    custom_domain: "",
  });

  useEffect(() => {
    if (branding) {
      setForm({
        company_name: branding.company_name ?? "",
        primary_color: branding.primary_color ?? "246 59% 50%",
        accent_color: branding.accent_color ?? "263 70% 50%",
        logo_url: branding.logo_url ?? "",
        favicon_url: branding.favicon_url ?? "",
        custom_domain: branding.custom_domain ?? "",
      });
    }
  }, [branding]);

  const handleSave = () => {
    saveBranding.mutate({
      company_name: form.company_name || null,
      primary_color: form.primary_color,
      accent_color: form.accent_color,
      logo_url: form.logo_url || null,
      favicon_url: form.favicon_url || null,
      custom_domain: form.custom_domain || null,
    });
  };

  if (isLoading) return <div className="animate-pulse h-40 bg-muted/20 rounded-xl" />;

  return (
    <div className="space-y-6">
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="w-5 h-5 text-primary" />
            Brand Identity
          </CardTitle>
          <CardDescription>Customize the platform appearance for your organization</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Company Name</Label>
              <Input
                value={form.company_name}
                onChange={(e) => setForm((p) => ({ ...p, company_name: e.target.value }))}
                placeholder="Acme Corp"
              />
            </div>
            <div className="space-y-2">
              <Label>Primary Color (HSL)</Label>
              <Input
                value={form.primary_color}
                onChange={(e) => setForm((p) => ({ ...p, primary_color: e.target.value }))}
                placeholder="246 59% 50%"
              />
            </div>
            <div className="space-y-2">
              <Label>Accent Color (HSL)</Label>
              <Input
                value={form.accent_color}
                onChange={(e) => setForm((p) => ({ ...p, accent_color: e.target.value }))}
                placeholder="263 70% 50%"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Image className="w-5 h-5 text-primary" />
            Assets
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Logo URL</Label>
              <Input
                value={form.logo_url}
                onChange={(e) => setForm((p) => ({ ...p, logo_url: e.target.value }))}
                placeholder="https://..."
              />
            </div>
            <div className="space-y-2">
              <Label>Favicon URL</Label>
              <Input
                value={form.favicon_url}
                onChange={(e) => setForm((p) => ({ ...p, favicon_url: e.target.value }))}
                placeholder="https://..."
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-primary" />
            Custom Domain
          </CardTitle>
          <CardDescription>Map your own domain to this platform instance</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label>Domain</Label>
            <Input
              value={form.custom_domain}
              onChange={(e) => setForm((p) => ({ ...p, custom_domain: e.target.value }))}
              placeholder="intelligence.acme.com"
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saveBranding.isPending}>
          {saveBranding.isPending ? "Saving..." : "Save Branding"}
        </Button>
      </div>

      {/* Preview */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className="rounded-lg p-6 border"
            style={{ borderColor: `hsl(${form.primary_color})` }}
          >
            <div className="flex items-center gap-3 mb-4">
              {form.logo_url && (
                <img src={form.logo_url} alt="Logo" className="h-8 w-8 object-contain" />
              )}
              <span className="font-bold text-lg" style={{ color: `hsl(${form.primary_color})` }}>
                {form.company_name || "Your Company"}
              </span>
            </div>
            <div className="flex gap-2">
              <div
                className="w-20 h-8 rounded"
                style={{ backgroundColor: `hsl(${form.primary_color})` }}
              />
              <div
                className="w-20 h-8 rounded"
                style={{ backgroundColor: `hsl(${form.accent_color})` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
