import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Layers } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ColumnFillPopoverProps {
  field: string;
  onFill: (field: string, value: string, mode: "all" | "empty") => void;
}

export const ColumnFillPopover = ({ field, onFill }: ColumnFillPopoverProps) => {
  const [open, setOpen] = useState(false);
  const [fillValue, setFillValue] = useState("");
  const [mode, setMode] = useState<"all" | "empty">("empty");
  const { toast } = useToast();

  const handleApply = () => {
    if (!fillValue.trim()) {
      toast({
        title: "Empty value",
        description: "Please enter a value to fill",
        variant: "destructive",
      });
      return;
    }

    onFill(field, fillValue, mode);
    setFillValue("");
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Layers className="h-3 w-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <div className="space-y-4">
          <div>
            <h4 className="font-medium text-sm mb-2">Fill Column: {field.replace(/_/g, " ")}</h4>
            <Input
              value={fillValue}
              onChange={(e) => setFillValue(e.target.value)}
              placeholder={`Enter ${field} value`}
              className="mb-3"
            />
          </div>
          
          <RadioGroup value={mode} onValueChange={(v) => setMode(v as "all" | "empty")}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="all" id={`${field}-all`} />
              <Label htmlFor={`${field}-all`} className="text-sm cursor-pointer">
                Apply to all rows
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="empty" id={`${field}-empty`} />
              <Label htmlFor={`${field}-empty`} className="text-sm cursor-pointer">
                Apply to empty cells only
              </Label>
            </div>
          </RadioGroup>

          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleApply}>
              Apply
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
