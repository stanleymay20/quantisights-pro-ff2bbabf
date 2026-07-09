import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { CapabilityEntry, CapabilityStatus } from "@/lib/trust-center-types";

const STATUS_STYLES: Record<CapabilityStatus, string> = {
  Implemented: "border-success/30 bg-success/10 text-success",
  "Partially Implemented": "border-warning/30 bg-warning/10 text-warning",
  Planned: "border-primary/30 bg-primary/10 text-primary",
  "Not Implemented": "border-destructive/30 bg-destructive/10 text-destructive",
  Unknown: "border-border bg-muted text-muted-foreground",
};

export function StatusBadge({ status }: { status: CapabilityStatus }) {
  return (
    <Badge
      variant="outline"
      className={cn("w-fit shrink-0 text-[10px] uppercase tracking-wide", STATUS_STYLES[status])}
      data-testid={`status-badge-${status.toLowerCase().replace(/\s+/g, "-")}`}
    >
      {status}
    </Badge>
  );
}

export interface CapabilityMatrixProps {
  capabilities: CapabilityEntry[];
  className?: string;
}

/**
 * TC-1 Capability Matrix: exactly one status per subsystem, never inferred —
 * each row's status and detail come directly from trust-center.ts.
 */
export default function CapabilityMatrix({ capabilities, className }: CapabilityMatrixProps) {
  return (
    <div className={cn("overflow-x-auto rounded-xl border border-border/50", className)} data-testid="capability-matrix">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[220px]">Capability</TableHead>
            <TableHead className="w-[160px]">Status</TableHead>
            <TableHead>Detail</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {capabilities.map((capability) => (
            <TableRow key={capability.key} data-testid={`capability-row-${capability.key}`}>
              <TableCell className="font-medium">{capability.label}</TableCell>
              <TableCell>
                <StatusBadge status={capability.status} />
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                <p>{capability.detail}</p>
                {capability.evidence.length > 0 && (
                  <p className="mt-1 text-[11px] text-muted-foreground/70">
                    Evidence: {capability.evidence.join(", ")}
                  </p>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
