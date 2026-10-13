import { buildSnippet, trackerScriptUrl, type SiteDto } from '@audience/shared';
import { useEffect, useRef } from 'react';
import { Button } from '../../components/ui/Button';
import { CodeBox } from '../../components/ui/CodeBox';
import { useToast } from '../../components/ui/Toast';
import { COPY_MESSAGES, copyText } from '../../lib/clipboard';
import styles from './Install.module.css';

export interface SnippetBoxProps {
  site: Pick<SiteDto, 'domain' | 'siteKey'>;
  /** Focus the Copy button on mount (step 2 of the Add website dialog). */
  autoFocusCopy?: boolean;
}

/**
 * The site's tracking code with the key in lime, and a Copy button. The script URL is this
 * dashboard's own origin, which serves /js/script.js (§4), so it's right in every environment.
 */
export function SnippetBox({ site, autoFocusCopy = false }: SnippetBoxProps) {
  const toast = useToast();
  const preRef = useRef<HTMLPreElement>(null);
  const copyRef = useRef<HTMLButtonElement>(null);
  const code = buildSnippet(site, trackerScriptUrl(window.location.origin));

  useEffect(() => {
    if (autoFocusCopy) copyRef.current?.focus();
  }, [autoFocusCopy]);

  return (
    <>
      <CodeBox
        ref={preRef}
        code={code}
        highlight={site.siteKey}
        label={`Tracking code for ${site.domain}`}
      />
      <div className={styles.codebar}>
        <span className={styles.note}>
          Website ID: <b>{site.siteKey}</b>
        </span>
        <Button
          ref={copyRef}
          variant="dark"
          onClick={() => void copyText(code, preRef.current).then((r) => toast(COPY_MESSAGES[r]))}
        >
          <CopyIcon />
          Copy code
        </Button>
      </div>
    </>
  );
}

export function CopyIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V5a1 1 0 0 1 1-1h9" />
    </svg>
  );
}
