'use client';

import { cn } from '@/lib/cn';

import type { AiLanguage } from '@/graphql/__generated__/graphql';

const LANGUAGES: readonly { value: AiLanguage; label: string; lang: string }[] = [
  { value: 'ENGLISH', label: 'English', lang: 'en' },
  { value: 'URDU', label: 'اردو', lang: 'ur' },
  { value: 'ROMAN_URDU', label: 'Roman Urdu', lang: 'en' },
];

/** Answer language for every AI feature (F-29: English, Urdu, Roman Urdu). */
export function LanguagePicker({
  value,
  onChange,
  disabled = false,
}: {
  value: AiLanguage;
  onChange: (language: AiLanguage) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset className="grid gap-2" disabled={disabled}>
      <legend className="mb-2 text-sm font-medium">Answer language</legend>
      <div className="flex flex-wrap gap-2">
        {LANGUAGES.map((language) => (
          <label
            key={language.value}
            lang={language.lang}
            className={cn(
              'cursor-pointer rounded-full border px-4 py-1.5 text-sm has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50',
              value === language.value
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-input bg-background hover:bg-muted',
            )}
          >
            <input
              type="radio"
              name="ai-language"
              value={language.value}
              checked={value === language.value}
              onChange={() => {
                onChange(language.value);
              }}
              className="sr-only"
            />
            {language.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
