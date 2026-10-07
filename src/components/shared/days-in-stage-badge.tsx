import {
  urgencyBadgeClasses,
  urgencyForDaysInStage,
  urgencyLabel,
} from "@/lib/domain/urgency";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface DaysInStageBadgeProps {
  days: number;
  className?: string;
}

/** Days-in-stage badge on the strict three-step urgency scale. */
export function DaysInStageBadge({ days, className }: DaysInStageBadgeProps) {
  const urgency = urgencyForDaysInStage(days);
  const label = urgencyLabel(urgency, days);
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            className={cn(
              urgencyBadgeClasses(urgency),
              "cursor-default font-medium",
              className
            )}
          >
            {days === 1 ? "1d" : `${days}d`}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>{label}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
