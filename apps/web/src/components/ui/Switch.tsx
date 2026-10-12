import { useId } from 'react';
import styles from './Switch.module.css';

export interface SwitchProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

/** Labeled on/off switch (site settings, §11). */
export function Switch({ label, description, checked, onChange, disabled = false }: SwitchProps) {
  const id = useId();
  const descId = `${id}-desc`;
  return (
    <div className={styles.switch}>
      <label htmlFor={id}>
        {label}
        {description && <small id={descId}>{description}</small>}
      </label>
      <input
        id={id}
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        aria-describedby={description ? descId : undefined}
        onChange={(e) => onChange(e.target.checked)}
      />
    </div>
  );
}
