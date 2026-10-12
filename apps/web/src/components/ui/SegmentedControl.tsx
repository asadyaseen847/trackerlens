import styles from './SegmentedControl.module.css';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedControlProps<T extends string> {
  label: string;
  options: ReadonlyArray<SegmentedOption<T>>;
  value: T;
  onChange: (value: T) => void;
  /** Smaller, shadowless variant (builder guides, chart/table toggle). */
  size?: 'default' | 'small';
}

/** Group of aria-pressed buttons (period switch, §11). */
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  size = 'default',
}: SegmentedControlProps<T>) {
  return (
    <div
      className={[styles.seg, size === 'small' && styles.small].filter(Boolean).join(' ')}
      role="group"
      aria-label={label}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
