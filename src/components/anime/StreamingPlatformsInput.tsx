"use client";

import * as React from "react";
import { Check, ChevronsUpDown, PlusCircle, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";

interface StreamingPlatformsInputProps {
  value: string[]; // Current selected platforms
  onChange: (newValue: string[]) => void; // Callback to update parent state
  apiSuggestions?: string[]; // Suggestions from API for the current anime
  placeholder?: string;
}

export function StreamingPlatformsInput({
  value,
  onChange,
  apiSuggestions = [],
  placeholder = "Select platforms...",
}: StreamingPlatformsInputProps) {
  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState("");
  
  // Memoize selectedPlatforms to avoid unnecessary recalculations
  const selectedPlatforms = React.useMemo(() => new Set(value), [value]);

  const togglePlatform = React.useCallback((platform: string) => {
    const newSelectedPlatforms = new Set(selectedPlatforms);
    if (newSelectedPlatforms.has(platform)) {
      newSelectedPlatforms.delete(platform);
    } else {
      newSelectedPlatforms.add(platform);
    }
    onChange(Array.from(newSelectedPlatforms));
  }, [selectedPlatforms, onChange]);

  const handleAddCustomPlatform = React.useCallback(() => {
    const trimmedInput = inputValue.trim();
    if (trimmedInput && !selectedPlatforms.has(trimmedInput)) {
      // Create a new Set from the current selectedPlatforms to ensure we're not mutating the memoized one directly before onChange
      const updatedSelectedPlatforms = new Set(selectedPlatforms);
      updatedSelectedPlatforms.add(trimmedInput);
      onChange(Array.from(updatedSelectedPlatforms));
      setInputValue(""); // Clear input after adding
    } else if (trimmedInput && selectedPlatforms.has(trimmedInput)) {
      // If platform already exists (e.g. user types an existing one and hits enter), just clear input
      setInputValue("");
    }
  }, [inputValue, selectedPlatforms, onChange]);

  // Combine API suggestions and current value for the dropdown list, ensuring uniqueness and sorting
  const allDisplaySuggestions = React.useMemo(() => {
    const suggestions = new Set(apiSuggestions);
    value.forEach(p => suggestions.add(p)); // Ensure current values are also in suggestions if they were custom
    return Array.from(suggestions).sort();
  }, [apiSuggestions, value]);

  return (
    <div className="space-y-2 w-full">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between h-auto min-h-10 py-2 text-left font-normal"
          >
            <span className="flex flex-wrap gap-1 items-center">
              {value.length > 0
                ? value.map((platform) => (
                    <Badge
                      key={platform}
                      variant="secondary"
                      className="px-2 py-0.5"
                      onClick={(e) => { // Make badges clickable to remove
                        e.stopPropagation(); 
                        togglePlatform(platform);
                      }}
                    >
                      {platform}
                      <X className="ml-1.5 h-3 w-3 cursor-pointer hover:text-destructive" />
                    </Badge>
                  ))
                : <span className="text-muted-foreground">{placeholder}</span>}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
          <Command 
            // Filter function for Command
            filter={(itemValue, search) => {
                // itemValue is the `value` prop of CommandItem
                // search is the current inputValue
                // Check if the command item's internal value (derived from its children text or value prop) contains the search query
                if (itemValue.toLowerCase().includes(search.toLowerCase())) return 1;
                return 0;
            }}
          >
            <CommandInput
              placeholder="Search or add platform..."
              value={inputValue}
              onValueChange={setInputValue}
              onKeyDown={(e) => {
                if (e.key === "Enter" && inputValue.trim()) {
                  e.preventDefault();
                  handleAddCustomPlatform();
                }
              }}
            />
            <CommandList>
              <CommandEmpty>
                {inputValue.trim() ? (
                    <span>No results. Press Enter to add "<strong>{inputValue.trim()}</strong>".</span>
                ) : (
                    "No platforms found."
                )}
              </CommandEmpty>
              <CommandGroup>
                {allDisplaySuggestions.map((platform) => (
                  <CommandItem
                    key={platform}
                    value={platform} // This value is used for filtering & onSelect
                    onSelect={() => {
                      togglePlatform(platform);
                      // Do not clear inputValue here, user might want to add more based on current search
                      // Keep popover open for multi-select
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selectedPlatforms.has(platform)
                          ? "opacity-100"
                          : "opacity-0"
                      )}
                    />
                    {platform}
                  </CommandItem>
                ))}
              </CommandGroup>
              {inputValue.trim() && !allDisplaySuggestions.some(s => s.toLowerCase() === inputValue.trim().toLowerCase()) && (
                 <CommandSeparator />
              )}
              {inputValue.trim() && !allDisplaySuggestions.some(s => s.toLowerCase() === inputValue.trim().toLowerCase()) && (
                <CommandGroup>
                    <CommandItem
                        key={`add-${inputValue.trim()}`}
                        value={`add-${inputValue.trim()}`} // Ensure this value is unique or handled by filter
                        onSelect={() => {
                            handleAddCustomPlatform();
                        }}
                        className="text-sm"
                    >
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Add "{inputValue.trim()}"
                    </CommandItem>
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}