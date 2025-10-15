import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { AlertCircle } from "lucide-react";

interface DeleteLeadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reasonCode: string, reasonText: string) => void;
  isDeleting: boolean;
}

const REASON_OPTIONS = [
  { value: "not_qualified", label: "Not qualified" },
  { value: "duplicate", label: "Duplicate" },
  { value: "moved_on", label: "Moved on with another agent" },
  { value: "price_sensitivity", label: "Price sensitivity" },
  { value: "timing", label: "Timing not right" },
  { value: "service_issue", label: "Service issue / bad fit" },
  { value: "unresponsive", label: "Unresponsive" },
  { value: "other", label: "Other" },
];

export function DeleteLeadModal({
  open,
  onOpenChange,
  onConfirm,
  isDeleting,
}: DeleteLeadModalProps) {
  const [reasonCode, setReasonCode] = useState<string>("");
  const [reasonText, setReasonText] = useState("");

  const handleSubmit = () => {
    if (reasonCode && reasonText.trim()) {
      onConfirm(reasonCode, reasonText.trim());
      setReasonCode("");
      setReasonText("");
    }
  };

  const charCount = reasonText.length;
  const isValid = reasonCode && reasonText.trim().length > 0 && charCount <= 100;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            Delete Lead
          </DialogTitle>
          <DialogDescription>
            This helps us understand patterns (e.g., timing, pricing) and improve your future results.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-3">
            <Label>Why are you deleting this client?</Label>
            <RadioGroup value={reasonCode} onValueChange={setReasonCode}>
              {REASON_OPTIONS.map((option) => (
                <div key={option.value} className="flex items-center space-x-2">
                  <RadioGroupItem value={option.value} id={option.value} />
                  <Label
                    htmlFor={option.value}
                    className="font-normal cursor-pointer"
                  >
                    {option.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="reason-text">Add a short note</Label>
              <span
                className={`text-xs ${
                  charCount > 100 ? "text-destructive" : "text-muted-foreground"
                }`}
              >
                {charCount}/100
              </span>
            </div>
            <Textarea
              id="reason-text"
              placeholder="e.g., Chose another agent; will revisit in 6 months."
              value={reasonText}
              onChange={(e) => setReasonText(e.target.value.slice(0, 100))}
              rows={3}
              maxLength={100}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleSubmit}
            disabled={!isValid || isDeleting}
          >
            {isDeleting ? "Deleting..." : "Delete Lead"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
