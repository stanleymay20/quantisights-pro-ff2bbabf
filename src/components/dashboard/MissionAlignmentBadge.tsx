import { memo } from "react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Compass, AlertTriangle, CheckCircle2, MinusCircle } from "lucide-react";

interface MissionAlignmentBadgeProps {
  score: number;
  alignment: string;
  factors: string[];
}

const MissionAlignmentBadge = memo(({ score, alignment, factors }: MissionAlignmentBadgeProps) => {
  const variant =
    score >= 75 ? "default" :
    score >= 50 ? "secondary" :
    score >= 25 ? "outline" :
    "destructive";

  const Icon =
    score >= 75 ? CheckCircle2 :
    score >= 50 ? Compass :
    score >= 25 ? MinusCircle :
    AlertTriangle;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant={variant} className="gap-1 text-[10px] cursor-help">
            <Icon className="w-3 h-3" />
            {alignment}
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs space-y-1 text-xs">
          <p className="font-semibold">Mission Alignment: {score}/100</p>
          {factors.length > 0 ? (
            <ul className="space-y-0.5">
              {factors.map((f, i) => (
                <li key={i} className="text-muted-foreground">• {f}</li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">No specific alignment factors detected. Complete your Organizational Identity in Settings.</p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
});

MissionAlignmentBadge.displayName = "MissionAlignmentBadge";

export default MissionAlignmentBadge;
