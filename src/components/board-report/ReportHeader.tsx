import quantivisLogo from "@/assets/quantivis-logo.png";

interface ReportHeaderProps {
  organizationName: string;
  generatedAt: string;
  generatedBy: string;
  tier: string;
}

const ReportHeader = ({ organizationName, generatedAt, generatedBy, tier }: ReportHeaderProps) => (
  <div className="px-16 pt-20 pb-12 border-b border-border/50 print:border-border">
    <div className="flex items-center gap-4 mb-12">
      <img src={quantivisLogo} alt="Quantivis" className="h-10 print:h-8" />
    </div>
    <h1 className="text-5xl font-light tracking-tight mb-4 print:text-4xl">
      Board Governance Report
    </h1>
    <p className="text-2xl text-muted-foreground font-light mb-8">
      {organizationName}
    </p>
    <div className="flex gap-8 text-sm text-muted-foreground">
      <span>
        Generated:{" "}
        {new Date(generatedAt).toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        })}
      </span>
      <span>By: {generatedBy}</span>
      <span className="uppercase tracking-wider">{tier} Plan</span>
    </div>
  </div>
);

export default ReportHeader;
