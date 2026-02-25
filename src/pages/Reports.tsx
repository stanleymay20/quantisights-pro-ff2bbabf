import { useState, useEffect } from "react";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/hooks/useOrganization";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { FileText, Download, Loader2, Plus } from "lucide-react";

interface Report {
  id: string;
  file_path: string;
  report_type: string;
  created_at: string;
}

const Reports = () => {
  const { user } = useAuth();
  const { currentOrgId } = useOrganization();
  const { toast } = useToast();
  const [reports, setReports] = useState<Report[]>([]);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchReports = async () => {
    if (!currentOrgId) return;
    const { data } = await supabase
      .from("reports")
      .select("*")
      .eq("organization_id", currentOrgId)
      .order("created_at", { ascending: false });
    setReports(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchReports();
  }, [currentOrgId]);

  const handleGenerate = async () => {
    if (!currentOrgId) return;
    setGenerating(true);
    try {
      // First generate insights
      await supabase.functions.invoke("generate-insights", {
        body: { organization_id: currentOrgId },
      });

      // Then generate report
      const { data, error } = await supabase.functions.invoke("generate-report", {
        body: { organization_id: currentOrgId },
      });

      if (error) throw error;

      if (data?.download_url) {
        window.open(data.download_url, "_blank");
      }

      toast({ title: "Report generated successfully!" });
      fetchReports();
    } catch (err: any) {
      toast({ title: "Failed to generate report", description: err.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async (filePath: string) => {
    const { data } = await supabase.storage.from("reports").createSignedUrl(filePath, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  return (
    <div className="flex min-h-screen bg-background">
      <DashboardSidebar />
      <div className="flex-1 flex flex-col min-h-screen">
        <header className="h-14 border-b border-border/30 flex items-center justify-between px-8 shrink-0 bg-background/60 backdrop-blur-sm">
          <h1 className="text-xl font-semibold font-display">Reports</h1>
          <button
            onClick={handleGenerate}
            disabled={generating || !currentOrgId}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:brightness-110 transition-all disabled:opacity-50"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {generating ? "Generating..." : "Generate Executive Report"}
          </button>
        </header>
        <main className="flex-1 p-8 overflow-auto">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : reports.length === 0 ? (
            <div className="glass-card p-12 rounded-xl flex flex-col items-center justify-center min-h-[400px]">
              <FileText className="w-16 h-16 text-muted-foreground mb-4" />
              <h2 className="text-xl font-semibold font-display mb-2">No Reports Yet</h2>
              <p className="text-muted-foreground text-sm mb-6">Generate your first executive report</p>
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="px-6 py-3 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:brightness-110 transition-all"
              >
                Generate Report
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {reports.map((report) => (
                <div key={report.id} className="glass-card p-5 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <FileText className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium capitalize">{report.report_type} Report</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(report.created_at).toLocaleDateString("en", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDownload(report.file_path)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-secondary transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Download
                  </button>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default Reports;
