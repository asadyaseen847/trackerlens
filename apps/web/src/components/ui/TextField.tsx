import { forwardRef, useId, type InputHTMLAttributes } from 'react';
import styles from './Form.module.css';

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string;
  /** Shown under the input and linked with aria-describedby; also marks it invalid. */
  error?: string | null;
  hint?: string;
}

/** Labeled text input in the prototype's style, with an inline error message. */
export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, error, hint, className, ...rest },
  ref,
) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ');

  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      <input
        ref={ref}
        id={id}
        className={[styles.input, className].filter(Boolean).join(' ')}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        {...rest}
      />
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
