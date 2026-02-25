interface SimulationSectionProps {
  simulation: any[];
}

const SimulationSection = ({ simulation }: SimulationSectionProps) => {
  if (simulation.length === 0) return null;

  return (
    <div className="px-16 py-12 border-b border-slate-700/50 print:border-slate-200">
      <h2 className="text-xs uppercase tracking-[0.2em] text-cyan-400 print:text-cyan-700 mb-8 font-semibold">
        Strategic Simulation Summary
      </h2>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {simulation.slice(0, 5).map((sim: any, i: number) => (
          <div key={i} className="border border-slate-700/50 print:border-slate-200 rounded-xl p-4 text-center">
            <div className="text-xs text-slate-500 mb-2">Projection {i + 1}</div>
            <div className="text-lg font-semibold text-slate-200 print:text-slate-800">
              {Number(sim.simulated_value).toLocaleString()}
            </div>
            <div className={`text-sm font-mono ${Number(sim.delta_value) >= 0 ? "text-emerald-400 print:text-emerald-700" : "text-red-400 print:text-red-700"}`}>
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
