import { ignoreVisitsUrl, type SiteDto } from '@audience/shared';
import { useRef, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { CodeBox } from '../../components/ui/CodeBox';
import { Dialog } from '../../components/ui/Dialog';
import { Switch } from '../../components/ui/Switch';
import { useToast } from '../../components/ui/Toast';
import { COPY_MESSAGES, copyText } from '../../lib/clipboard';
import { errorMessage } from '../auth/useAuth';
import { useDeleteSite, useUpdateSite } from '../websites/queries';
import styles from './Install.module.css';

export interface SiteSettingsProps {
  site: SiteDto;
  canRemove: boolean;
  onRemoved: () => void;
}

/** Count subdomains, pause tracking, ignore my visits, and remove (§11). */
export function SiteSettings({ site, canRemove, onRemoved }: SiteSettingsProps) {
  const toast = useToast();
  const updateSite = useUpdateSite();
  const deleteSite = useDeleteSite();
  const [showIgnore, setShowIgnore] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const linkRef = useRef<HTMLPreElement>(null);
  const ignoreLink = ignoreVisitsUrl(site.domain);

  function save(patch: { includeSubdomains?: boolean; paused?: boolean }, message: string) {
    updateSite.mutate(
      { id: site.id, ...patch },
      { onSuccess: () => toast(message), onError: (err) => toast(errorMessage(err)) },
    );
  }

  return (
    <>
      <div className={styles.switches}>
        <Switch
          label="Ignore my own visits"
          description="Visits from this browser won't be counted"
          checked={showIgnore}
          onChange={setShowIgnore}
        />
        {showIgnore && (
          <div className={styles.ignore}>
            <p className={styles.note}>
              Open this link once in each browser you use. It only affects that browser.
            </p>
            <CodeBox ref={linkRef} code={ignoreLink} label="Ignore-my-visits link" wrap />
            <div>
              <Button
                variant="dark"
                onClick={() =>
                  void copyText(ignoreLink, linkRef.current).then((r) => toast(COPY_MESSAGES[r]))
                }
              >
                Copy link
              </Button>
            </div>
          </div>
        )}
        <Switch
          label="Count subdomains too"
          description="For example blog. and shop. on the same domain"
          checked={site.settings.includeSubdomains}
          disabled={updateSite.isPending}
          onChange={(checked) => save({ includeSubdomains: checked }, 'Saved')}
        />
        <Switch
          label="Pause tracking"
          description="The code stays, but no visits are counted"
          checked={site.settings.paused}
          disabled={updateSite.isPending}
          onChange={(checked) =>
            save({ paused: checked }, checked ? 'Tracking paused' : 'Tracking resumed')
          }
        />
      </div>

      {canRemove && (
        <div>
          <Button variant="danger" onClick={() => setConfirming(true)}>
            Remove this website
          </Button>
        </div>
      )}

      <Dialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title={`Remove ${site.domain}?`}
        actions={
          <>
            <Button onClick={() => setConfirming(false)}>Keep it</Button>
            <Button
              variant="dark"
              disabled={deleteSite.isPending}
              onClick={() =>
                deleteSite.mutate(site.id, {
                  onSuccess: () => {
                    setConfirming(false);
                    toast(`${site.domain} removed`);
                    onRemoved();
                  },
                  onError: (err) => toast(errorMessage(err)),
                })
              }
            >
              {deleteSite.isPending ? 'Removing…' : 'Remove website'}
            </Button>
          </>
        }
      >
        <p className={styles.note}>
          All of its visits and page views are deleted for good. The code on the website stops being
          counted. This can’t be undone.
        </p>
      </Dialog>
    </>
  );
}
