import styles from './Toast.module.css';

export interface ToastProps {
  /** null hides the toast. */
  message: string | null;
}

/**
 * Polite status toast for copy, save and connect actions.
 * TODO(Phase 1, §11): toast provider + auto-dismiss.
 */
export function Toast({ message }: ToastProps) {
  return (
    <div role="status" aria-live="polite">
      {message && <div className={styles.toast}>{message}</div>}
    </div>
  );
}
