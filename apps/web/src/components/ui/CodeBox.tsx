import { forwardRef } from 'react';
import styles from './CodeBox.module.css';

export interface CodeBoxProps {
  code: string;
  /** Substring to highlight in lime (the site key, §11). */
  highlight?: string;
  label: string;
  /** Wrap long lines (links) instead of scrolling sideways. */
  wrap?: boolean;
}

/** Ink code block. The ref points at the <pre>, for "select the text" copy fallbacks. */
export const CodeBox = forwardRef<HTMLPreElement, CodeBoxProps>(function CodeBox(
  { code, highlight, label, wrap = false },
  ref,
) {
  const parts = highlight ? code.split(highlight) : [code];
  return (
    <div className={styles.codebox}>
      <pre ref={ref} aria-label={label} className={wrap ? styles.wrap : undefined}>
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
});
