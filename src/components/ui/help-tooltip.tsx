import { HelpCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface HelpTooltipProps {
  content: string;
  className?: string;
  side?: "top" | "right" | "bottom" | "left";
  iconSize?: string;
}

/**
 * Jargon-busting inline tooltip — hover/tap to see a plain-English explanation.
 */
const HelpTooltip = ({ content, className, side = "right", iconSize = "w-3 h-3" }: HelpTooltipProps) => (
  <TooltipProvider delayDuration={200}>
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center justify-center rounded-full text-muted-foreground/60 hover:text-muted-foreground transition-colors focus:outline-none",
            className
          )}
          aria-label="More info"
        >
          <HelpCircle className={iconSize} />
        </button>
      </TooltipTrigger>
      <TooltipContent
        side={side}
        className="max-w-[240px] text-xs leading-relaxed font-normal"
      >
        {content}
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

export default HelpTooltip;
