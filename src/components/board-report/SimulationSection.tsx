interface SimulationSectionProps {
  simulation: Array<{ scenario: string; expected_value?: number; p10?: number; p50?: number; p90?: number; [key: string]: unknown }>;
}

const SimulationSection = ({ simulation }: SimulationSectionProps) => {
  if (simulation.length === 0) return null;

  return (
    <div className="px-16 py-12 border-b border-border/50 print:border-border">
      <h2 className="text-xs uppercase tracking-[0.2em] text-primary mb-8 font-semibold">
        Strategic Simulation Summary
      </h2>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {simulation.slice(0, 5).map((sim: { scenario: string; expected_value?: number; p10?: number; p50?: number; p90?: number; [key: string]: unknown }, i: number) => (
          <div key={i} className="border border-border/50 print:border-border rounded-xl p-4 text-center">
            <div className="text-xs text-muted-foreground mb-2">Projection {i + 1}</div>
            <div className="text-lg font-semibold text-foreground/90 print:text-foreground">
              {Number(sim.simulated_value).toLocaleString()}
            </div>
            <div className={`text-sm font-mono ${Number(sim.delta_value) >= 0 ? "text-success" : "text-destructive"}`}>
              {Number(sim.delta_value) >= 0 ? "+" : ""}
              {Number(sim.delta_value).toLocaleString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SimulationSection;
