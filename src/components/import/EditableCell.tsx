import { useState, useRef, useEffect, memo } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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

// Helper to calculate character width
const calcChWidth = (value: string, minCh = 4, maxCh = 20): string => {
  const length = value?.toString().length || 0;
  return `${Math.min(Math.max(length, minCh), maxCh)}ch`;
};

// Helper to auto-size textarea
const autosizeTextArea = (el: HTMLTextAreaElement) => {
  el.style.height = "0px";
  const scrollHeight = el.scrollHeight;
  el.style.height = scrollHeight + "px";
};

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
  const [isFocusedState, setIsFocusedState] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setLocalValue(value ?? "");
  }, [value]);

  useEffect(() => {
    if (isFocused) {
      if (inputRef.current) inputRef.current.focus();
      if (textareaRef.current) textareaRef.current.focus();
    }
  }, [isFocused]);

  useEffect(() => {
    if (textareaRef.current) {
      autosizeTextArea(textareaRef.current);
    }
  }, [localValue]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const isTextarea = field === "notes" || (localValue?.toString().length || 0) > 20 || isFocusedState;
    
    // For textarea, allow Enter for newlines, Ctrl+Enter to navigate
    if (isTextarea && e.key === "Enter" && !e.ctrlKey && !e.metaKey) {
      return; // Allow newline
    }
    
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey || !isTextarea)) {
      e.preventDefault();
      if (e.shiftKey) {
        onNavigate("up");
      } else {
        onNavigate("down");
      }
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
    onChange(rowIndex, field, newValue);
  };

  const handleBlur = () => {
    setIsFocusedState(false);
    onBlur(rowIndex, field);
  };

  const handleFocus = () => {
    setIsFocusedState(true);
  };

  if (!isEditing) {
    const displayValue = value ?? "";
    return (
      <span className="text-sm break-words">
        {displayValue || <span className="text-muted-foreground">—</span>}
      </span>
    );
  }

  const hasError = !!error;
  const valueLength = (localValue?.toString().length || 0);
  const shouldUseTextarea = field === "notes" || valueLength > 20 || isFocusedState;
  const width = calcChWidth(localValue?.toString() || "", 4, 20);

  return (
    <TooltipProvider>
      <Tooltip open={hasError && isFocused}>
        <TooltipTrigger asChild>
          <div className="align-top break-words whitespace-normal">
            {shouldUseTextarea ? (
              <Textarea
                ref={textareaRef}
                value={localValue}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                onBlur={handleBlur}
                onFocus={handleFocus}
                className={`text-sm resize-none overflow-hidden leading-5 min-h-[2rem] py-1.5 ${
                  hasError ? "border-red-500" : ""
                }`}
                style={{ width: "20ch", maxWidth: "20ch" }}
                placeholder={field === "zip" ? "12345" : ""}
              />
            ) : (
              <Input
                ref={inputRef}
                value={localValue}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                onBlur={handleBlur}
                onFocus={handleFocus}
                className={`h-8 text-sm truncate ${hasError ? "border-red-500" : ""}`}
                style={{ width }}
                placeholder={field === "zip" ? "12345" : ""}
              />
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
