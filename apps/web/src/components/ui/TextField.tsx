import { forwardRef, useId, useState, type InputHTMLAttributes } from 'react';
import styles from './Form.module.css';

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string;
  /** Shown under the input and linked with aria-describedby; also marks it invalid. */
  error?: string | null;
  hint?: string;
}

/**
 * Labeled text input in the prototype's style, with an inline error message. Password
 * fields get an eye button that shows or hides what was typed.
 */
export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, error, hint, className, type, ...rest },
  ref,
) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ');
  const isPassword = type === 'password';
  const [shown, setShown] = useState(false);

  const input = (
    <input
      ref={ref}
      id={id}
      type={isPassword && shown ? 'text' : type}
      className={[styles.input, isPassword ? styles.withToggle : null, className]
        .filter(Boolean)
        .join(' ')}
      aria-invalid={error ? true : undefined}
      aria-describedby={describedBy || undefined}
      {...rest}
    />
  );

  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      {isPassword ? (
        <div className={styles.passwordWrap}>
          {input}
          <button
            type="button"
            className={styles.toggle}
            onClick={() => setShown((v) => !v)}
            aria-label={shown ? 'Hide password' : 'Show password'}
            aria-pressed={shown}
            aria-controls={id}
            title={shown ? 'Hide password' : 'Show password'}
          >
            {shown ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        </div>
      ) : (
        input
      )}
      {hint && (
        <small id={hintId} className={styles.hint}>
          {hint}
        </small>
      )}
      {error && (
        <div id={errorId} className={styles.err}>
          {error}
        </div>
      )}
    </div>
  );
});

const iconProps = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2.2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const;

function EyeIcon() {
  return (
    <svg {...iconProps}>
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg {...iconProps}>
      <path d="M10.6 5.1A10.6 10.6 0 0 1 12 5c6.4 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.2" />
      <path d="M6.6 6.6C3.8 8.4 2 12 2 12s3.6 7 10 7a9.7 9.7 0 0 0 5.4-1.6" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
      <path d="m2 2 20 20" />
    </svg>
  );
}
