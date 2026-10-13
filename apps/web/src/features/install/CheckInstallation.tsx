import type { SiteDto, SiteStatusResponse } from '@audience/shared';
import { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { api } from '../../lib/api';
import { formatRelative } from '../../lib/format';
import { errorMessage } from '../auth/useAuth';
import styles from './Install.module.css';

export interface CheckInstallationProps {
  site: Pick<SiteDto, 'id' | 'settings'>;
}

/** "Check installation": asks the API whether the code has sent a visit yet (§11). */
export function CheckInstallation({ site }: CheckInstallationProps) {
  const [result, setResult] = useState('');
  const [checking, setChecking] = useState(false);

  async function check() {
    setChecking(true);
    setResult('Checking…');
    try {
      const status = await api<SiteStatusResponse>(`/sites/${site.id}/status`);
      if (site.settings.paused) setResult('Tracking is paused for this website.');
      else if (status.installed && status.lastEventAt) {
        setResult(`✓ Working. Last visit ${formatRelative(status.lastEventAt)}.`);
      } else {
        setResult(
          'No visits yet. Check the code is saved and published, then open your site once.',
        );
      }
    } catch (err) {
      setResult(errorMessage(err));
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className={styles.checkline}>
      <Button onClick={() => void check()} disabled={checking}>
        Check installation
      </Button>
      <span className={styles.result} aria-live="polite">
        {result}
      </span>
    </div>
  );
}
