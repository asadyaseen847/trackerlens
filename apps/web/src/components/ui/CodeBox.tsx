import styles from './CodeBox.module.css';

export interface CodeBoxProps {
  code: string;
  /** Substring to highlight in lime (the site key, §11). */
  highlight?: string;
  label: string;
}

/** Ink code block for the tracking snippet. TODO(Phase 1, §11): Copy button + Ctrl+C fallback. */
export function CodeBox({ code, highlight, label }: CodeBoxProps) {
  const parts = highlight ? code.split(highlight) : [code];
  return (
    <div className={styles.codebox}>
      <pre aria-label={label}>
        <code>
          {parts.map((part, i) => (
            <span key={i}>
              {part}
              {highlight && i < parts.length - 1 && <span className={styles.hl}>{highlight}</span>}
            </span>
          ))}
        </code>
      </pre>
    </div>
  );
}
