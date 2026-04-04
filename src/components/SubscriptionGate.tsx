import { useSubscriptionGate } from "@/hooks/useSubscriptionGate";
import { useNavigate } from "react-router-dom";
import { Lock, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface Props {
  feature: string;
  children: React.ReactNode;
  fallbackMessage?: string;
}

/**
 * Wraps a feature behind a subscription tier gate.
 * Shows an upgrade prompt if the user's tier doesn't include the feature.
 */
const SubscriptionGate = ({ feature, children, fallbackMessage }: Props) => {
  const { canAccess, loading, tier } = useSubscriptionGate();
  const navigate = useNavigate();

  if (loading) return <>{children}</>;

  if (!canAccess(feature)) {
    return (
      <Card className="border-dashed border-2 border-primary/20">
        <CardContent className="flex flex-col items-center justify-center py-12 gap-4 text-center">
          <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center">
            <Lock className="w-7 h-7 text-primary" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-semibold">
              {fallbackMessage || "This feature requires an upgrade"}
            </h3>
            <p className="text-sm text-muted-foreground max-w-md">
              {tier
                ? "Your current plan doesn't include this capability. Upgrade to unlock it."
                : "Subscribe to a plan to access this feature."}
            </p>
          </div>
          <Button onClick={() => navigate("/pricing")} className="gap-2">
            <Crown className="w-4 h-4" /> View Plans
          </Button>
        </CardContent>
      </Card>
    );
  }

  return <>{children}</>;
};

export default SubscriptionGate;
