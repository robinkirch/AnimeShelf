
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RATING_OPTIONS } from "@/types/anime";

interface RatingInputProps {
  value: number | null;
  onChange: (value: number | null) => void;
  disabled?: boolean;
}

const NO_RATING_VALUE = "_none_"; // Use a distinct non-empty string

export function RatingInput({ value, onChange, disabled }: RatingInputProps) {
  const handleChange = (selectedValue: string) => {
    if (selectedValue === NO_RATING_VALUE) {
      onChange(null);
    } else {
      const numericValue = parseInt(selectedValue, 10);
      onChange(isNaN(numericValue) ? null : numericValue);
    }
  };

  return (
    <Select
      value={value?.toString() || NO_RATING_VALUE} // Default to NO_RATING_VALUE if value is null
      onValueChange={handleChange}
      disabled={disabled}
    >
      <SelectTrigger className="w-[180px] text-sm">
        <SelectValue placeholder="Rate anime..." />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NO_RATING_VALUE}>No Rating</SelectItem>
        {RATING_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value.toString()}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

    