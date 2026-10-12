import type { CSSProperties } from 'react';
import styles from './Chip.module.css';

export interface ChipProps {
  label: string;
  pressed: boolean;
  /** Swatch color, usually a token such as "var(--t-social)". */
  color: string;
  onToggle: () => void;
  disabled?: boolean;
}

/** Toggle chip with a colored swatch (filter bar channel chips, §11). */
export function Chip({ label, pressed, color, onToggle, disabled = false }: ChipProps) {
  return (
    <button
      type="button"
      className={styles.chip}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onToggle}
      style={{ '--c': color } as CSSProperties}
    >
      <span className={styles.sw} aria-hidden="true" />
      {label}
    </button>
  );
}
