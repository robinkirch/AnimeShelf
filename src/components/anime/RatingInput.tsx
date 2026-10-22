
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RATING_OPTIONS } from "@/types/anime";
import { useI18n } from '@/i18n/I18nContext';
import { ratingLabel } from '@/i18n/labels';

interface RatingInputProps {
  value: number | null;
  onChange: (value: number | null) => void;
  disabled?: boolean;
}

const NO_RATING_VALUE = "_none_"; // Use a distinct non-empty string

export function RatingInput({ value, onChange, disabled }: RatingInputProps) {
  const { t } = useI18n();
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
        <SelectValue placeholder={t('anime.ratePlaceholder')} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NO_RATING_VALUE}>{t('anime.noRating')}</SelectItem>
        {RATING_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value.toString()}>
            {ratingLabel(t, option.value)}
</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

    