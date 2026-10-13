import type { SiteDto } from '@audience/shared';
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { useToast } from '../../components/ui/Toast';
import { SnippetBox } from '../install/SnippetBox';
import { AddSiteForm } from './AddSiteForm';
import styles from './AddSiteDialog.module.css';

export interface AddSiteDialogProps {
  open: boolean;
  onClose: () => void;
}

/** Two steps: (1) the website address, (2) its code with Copy, install steps and Done (§11). */
export function AddSiteDialog({ open, onClose }: AddSiteDialogProps) {
  const [site, setSite] = useState<SiteDto | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const toast = useToast();

  function close() {
    setSite(null);
    onClose();
  }

  const steps = (
    <div className={styles.steps} aria-hidden="true">
      <span className={site ? undefined : styles.on}>1 · Website</span>
      <span className={site ? styles.on : undefined}>2 · Code</span>
    </div>
  );

  return (
    <Dialog
      open={open}
      onClose={close}
      header={steps}
      initialFocusRef={inputRef}
      title={site ? `Paste this on ${site.domain}` : 'Add a website'}
      actions={
        site && (
          <>
            <Button
              onClick={() => {
                close();
                void navigate(`/app/install?site=${site.id}`);
              }}
            >
              Show install steps
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                toast(`${site.domain} added`);
                close();
              }}
            >
              Done
            </Button>
          </>
        )
      }
    >
      {site ? (
        <>
          <p className={styles.note}>
            Put it in the global header or footer so it runs on every page. Visits start showing a
            minute after the first visitor arrives.
          </p>
          <SnippetBox site={site} autoFocusCopy />
        </>
      ) : (
        <AddSiteForm
          ref={inputRef}
          onCreated={setSite}
          secondaryAction={<Button onClick={close}>Cancel</Button>}
        />
      )}
    </Dialog>
  );
}
