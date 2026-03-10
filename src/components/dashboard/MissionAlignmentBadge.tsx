import { memo } from "react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Compass, AlertTriangle, CheckCircle2, MinusCircle, ShieldAlert } from "lucide-react";

interface MissionAlignmentBadgeProps {
  score: number;
  alignment: string;
  factors: string[];
  ethicalConflict?: boolean;
}

const MissionAlignmentBadge = memo(({ score, alignment, factors, ethicalConflict }: MissionAlignmentBadgeProps) => {
  const variant =
    ethicalConflict ? "destructive" :
    score >= 75 ? "default" :
    score >= 50 ? "secondary" :
    score >= 25 ? "outline" :
    "destructive";

  const Icon =
    ethicalConflict ? ShieldAlert :
    score >= 75 ? CheckCircle2 :
    score >= 50 ? Compass :
    score >= 25 ? MinusCircle :
    AlertTriangle;

  const label = ethicalConflict ? "Ethical Conflict" : alignment;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant={variant} className={`gap-1 text-[10px] cursor-help ${ethicalConflict ? "animate-pulse" : ""}`}>
            <Icon className="w-3 h-3" />
            {label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs space-y-1.5 text-xs">
          <p className="font-semibold">Mission Alignment: {score}/100</p>
          {ethicalConflict && (
            <div className="flex items-start gap-1.5 p-1.5 rounded bg-destructive/10 border border-destructive/20">
              <ShieldAlert className="w-3 h-3 text-destructive shrink-0 mt-0.5" />
              <p className="text-[10px] text-destructive font-medium">
                This recommendation touches an organizational ethical boundary. Review carefully before acting.
              </p>
            </div>
          )}
          {factors.length > 0 ? (
            <ul className="space-y-0.5">
              {factors.map((f, i) => (
                <li key={i} className={`${f.startsWith("⚠") ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                  • {f}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">No specific alignment factors detected. Complete your Organizational Identity in Settings.</p>
          )}
          {score < 25 && !ethicalConflict && (
            <p className="text-[10px] text-warning italic">
              Low alignment — this decision may not support current organizational priorities.
            </p>
          )}
          {score >= 75 && (
            <p className="text-[10px] text-success italic">
              Strong alignment — this decision supports strategic priorities and core values.
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
});

MissionAlignmentBadge.displayName = "MissionAlignmentBadge";

export default MissionAlignmentBadge;
