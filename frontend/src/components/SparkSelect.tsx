import { CheckCircle2, ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

export type SparkSelectOption = {
  value: string;
  label: string;
  hint?: string;
};

type SparkSelectProps = {
  ariaLabel: string;
  value: string;
  options: SparkSelectOption[];
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
};

export function SparkSelect({ ariaLabel, value, options, onChange, className = "", disabled = false }: SparkSelectProps) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  function choose(nextValue: string) {
    onChange(nextValue);
    setOpen(false);
  }

  return (
    <div className={`spark-select spark-custom-select ${className}`.trim()} ref={rootRef}>
      <select
        className="spark-select-native-proxy"
        aria-label={ariaLabel}
        value={value}
        disabled={disabled}
        onChange={(event) => choose(event.target.value)}
      >
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      <button
        type="button"
        className="spark-select-trigger"
        aria-label={`${ariaLabel} menu`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-listbox`}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "Escape") setOpen(false);
        }}
      >
        <span>
          <strong>{selected?.label ?? "Select option"}</strong>
          {selected?.hint && <small>{selected.hint}</small>}
        </span>
        <ChevronDown size={17} aria-hidden="true" />
      </button>
      {open && (
        <div className="spark-select-menu" id={`${id}-listbox`} role="listbox" aria-label={`${ariaLabel} options`}>
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              className={option.value === value ? "spark-select-option selected" : "spark-select-option"}
              onClick={() => choose(option.value)}
            >
              <span>
                <strong>{option.label}</strong>
                {option.hint && <small>{option.hint}</small>}
              </span>
              {option.value === value && <CheckCircle2 size={16} aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
