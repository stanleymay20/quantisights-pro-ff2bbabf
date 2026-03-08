import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { XCircle } from "lucide-react";

interface DismissReasonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  decisionTitle: string;
  onConfirm: (reason: string) => void;
}

/**
 * Captures a dismiss reason before logging the dismissal to the decision ledger.
 * Reason is optional but encouraged for governance defensibility.
 */
const DismissReasonDialog = ({
  open,
  onOpenChange,
  decisionTitle,
  onConfirm,
}: DismissReasonDialogProps) => {
  const [reason, setReason] = useState("");

  const handleConfirm = () => {
    onConfirm(reason.trim().slice(0, 500));
    setReason("");
  };

  const handleCancel = () => {
    setReason("");
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <XCircle className="w-5 h-5 text-muted-foreground" />
            Dismiss Decision
          </AlertDialogTitle>
          <AlertDialogDescription className="text-sm leading-relaxed">
            Dismissing: <strong className="text-foreground">"{decisionTitle}"</strong>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2 py-2">
          <Label className="text-xs">Reason for dismissal (recommended for audit trail)</Label>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Already addressed, not relevant to current context, duplicate signal…"
            className="text-sm min-h-[80px]"
            maxLength={500}
          />
          <p className="text-[10px] text-muted-foreground">
            This will be logged to the decision ledger for governance compliance.
          </p>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm}>
            Dismiss & Log
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default DismissReasonDialog;
