import { useId } from 'react';
import styles from './Select.module.css';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps {
  label: string;
  options: ReadonlyArray<SelectOption>;
  value: string;
  onChange: (value: string) => void;
}

/** Labeled native select (filter bar device and country, §11). */
export function Select({ label, options, value, onChange }: SelectProps) {
  const id = useId();
  return (
    <label className={styles.field} htmlFor={id}>
      {label}
      <select
        id={id}
        className={styles.select}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
