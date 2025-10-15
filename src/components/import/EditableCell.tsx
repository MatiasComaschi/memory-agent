import { useState, useRef, useEffect, memo } from "react";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertCircle } from "lucide-react";

interface EditableCellProps {
  value: any;
  field: string;
  rowIndex: number;
  isEditing: boolean;
  error?: string;
  onChange: (rowIndex: number, field: string, value: any) => void;
  onNavigate: (direction: "up" | "down" | "left" | "right") => void;
  onBlur: (rowIndex: number, field: string) => void;
  isFocused?: boolean;
}

export const EditableCell = memo(({
  value,
  field,
  rowIndex,
  isEditing,
  error,
  onChange,
  onNavigate,
  onBlur,
  isFocused = false,
}: EditableCellProps) => {
  const [localValue, setLocalValue] = useState(value ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalValue(value ?? "");
  }, [value]);

  useEffect(() => {
    if (isFocused && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isFocused]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onNavigate("down");
    } else if (e.key === "Enter" && e.shiftKey) {
      e.preventDefault();
      onNavigate("up");
    } else if (e.key === "Tab" && !e.shiftKey) {
      e.preventDefault();
      onNavigate("right");
    } else if (e.key === "Tab" && e.shiftKey) {
      e.preventDefault();
      onNavigate("left");
    } else if (e.key === "ArrowUp" && e.ctrlKey) {
      e.preventDefault();
      onNavigate("up");
    } else if (e.key === "ArrowDown" && e.ctrlKey) {
      e.preventDefault();
      onNavigate("down");
    } else if (e.key === "ArrowLeft" && e.ctrlKey) {
      e.preventDefault();
      onNavigate("left");
    } else if (e.key === "ArrowRight" && e.ctrlKey) {
      e.preventDefault();
      onNavigate("right");
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
    onChange(rowIndex, field, newValue);
  };

  const handleBlur = () => {
    onBlur(rowIndex, field);
  };

  if (!isEditing) {
    const displayValue = value ?? "";
    return (
      <span className="text-sm">
        {displayValue || <span className="text-muted-foreground">—</span>}
      </span>
    );
  }

  const hasError = !!error;
  const isEmpty = !value || value.toString().trim() === "";

  return (
    <TooltipProvider>
      <Tooltip open={hasError && isFocused}>
        <TooltipTrigger asChild>
          <div className="relative">
            <Input
              ref={inputRef}
              value={localValue}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onBlur={handleBlur}
              className={`h-8 text-sm ${hasError ? "border-red-500" : ""}`}
              placeholder={field === "zip" ? "12345" : ""}
            />
            {isEmpty && !hasError && (
              <AlertCircle className="absolute right-2 top-2 h-4 w-4 text-amber-500 opacity-50" />
            )}
          </div>
        </TooltipTrigger>
        {hasError && (
          <TooltipContent side="top" className="bg-red-500 text-white">
            <p className="text-xs">{error}</p>
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  );
});

EditableCell.displayName = "EditableCell";
