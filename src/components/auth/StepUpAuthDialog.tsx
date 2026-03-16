import { useState } from "react";
import {
  AlertDialog, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, AlertTriangle, Loader2 } from "lucide-react";
import type { SensitiveAction } from "@/hooks/useStepUpAuth";

interface StepUpAuthDialogProps {
  open: boolean;
  action: SensitiveAction | null;
  actionLabel: string;
  onVerify: (password: string) => Promise<boolean>;
  onVerified: () => void;
  onCancel: () => void;
}

const ACTION_DESCRIPTIONS: Record<SensitiveAction, string> = {
  export_data: "Exporting sensitive data requires re-authentication.",
  retention_cleanup: "Running data cleanup requires re-authentication.",
  connector_config: "Modifying data connectors requires re-authentication.",
  policy_change: "Changing security policies requires re-authentication.",
  role_change: "Modifying user roles requires re-authentication.",
  delete_account: "Deleting your account requires re-authentication.",
  scim_config: "Managing SCIM provisioning requires re-authentication.",
  session_revoke_all: "Revoking all sessions requires re-authentication.",
  passkey_remove: "Removing a passkey requires re-authentication.",
  webhook_trigger: "Triggering an outbound webhook requires re-authentication.",
  slack_send: "Sending a Slack notification requires re-authentication.",
};

const StepUpAuthDialog = ({
  open, action, actionLabel, onVerify, onVerified, onCancel,
}: StepUpAuthDialogProps) => {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const ok = await onVerify(password);
    setLoading(false);
    if (ok) {
      setPassword("");
      onVerified();
    } else {
      setError("Incorrect password. Please try again.");
    }
  };

  return (
    <AlertDialog open={open}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Re-authentication Required
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>{action ? ACTION_DESCRIPTIONS[action] : "This action requires re-authentication."}</p>
            <p className="text-xs text-muted-foreground">
              Action: <span className="font-medium text-foreground">{actionLabel}</span>
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="step-up-password">Current Password</Label>
            <Input
              id="step-up-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              autoFocus
              required
            />
            {error && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> {error}
              </p>
            )}
          </div>

          <AlertDialogFooter>
            <Button type="button" variant="outline" onClick={() => { setPassword(""); setError(""); onCancel(); }}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !password}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Confirm
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default StepUpAuthDialog;
