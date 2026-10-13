import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { Panel } from '../../components/ui/Panel';
import { Select } from '../../components/ui/Select';
import { Skeleton } from '../../components/ui/Skeleton';
import { useMe } from '../auth/useAuth';
import { AddSiteDialog } from '../websites/AddSiteDialog';
import { useSites } from '../websites/queries';
import { BuilderGuides } from './BuilderGuides';
import styles from './Install.module.css';
import { LinkBuilder } from './LinkBuilder';
import { SiteSettings } from './SiteSettings';
import { CheckInstallation } from './CheckInstallation';
import { SnippetBox } from './SnippetBox';
import { WhatWeCollect } from './WhatWeCollect';

export function InstallPage() {
  const { data: sites, isPending, isError, refetch } = useSites();
  const { data: me } = useMe();
  const [params, setParams] = useSearchParams();
  const [adding, setAdding] = useState(false);

  const site = sites?.find((s) => s.id === params.get('site')) ?? sites?.[0];
  const selectSite = (id: string | null) => setParams(id ? { site: id } : {}, { replace: true });

  return (
    <>
      <div className={styles.headrow}>
        <div>
          <h1>Install the tracking code</h1>
          <p className={styles.insight}>
            Each website gets its own one-line code. Paste it once in the site’s global header or
            footer and every page is counted.
          </p>
        </div>
        <Button variant="primary" onClick={() => setAdding(true)}>
          <PlusIcon />
          Add website
        </Button>
      </div>

      {isPending ? (
        <div className={styles.two} aria-busy="true">
          <span className="sr-only">Loading your websites…</span>
          <Skeleton height={260} radius={22} />
          <Skeleton height={260} radius={22} />
        </div>
      ) : isError ? (
        <EmptyState
          title="We couldn’t load your websites"
          body="Check your internet connection, then try again."
          action={<Button onClick={() => void refetch()}>Try again</Button>}
        />
      ) : !site ? (
        <EmptyState
          title="Add your first website"
          body="Type its address and you’ll get a one-line code to paste into the site."
          action={<Button onClick={() => setAdding(true)}>Add website</Button>}
        />
      ) : (
        <>
          <div className={styles.two}>
            <Panel
              title="Your code"
              sub="Paste it before the closing </head> tag, or in the footer"
              actions={
                <Select
                  label="Website"
                  value={site.id}
                  options={(sites ?? []).map((s) => ({ value: s.id, label: s.domain }))}
                  onChange={selectSite}
                />
              }
            >
              <SnippetBox site={site} />
              <CheckInstallation key={site.id} site={site} />
            </Panel>

            <Panel title="Where to paste it" sub="Pick the tool your website is built with">
              <BuilderGuides />
            </Panel>
          </div>

          <div className={styles.two}>
            <Panel title="Website settings" sub={`For ${site.domain}`}>
              <SiteSettings
                key={site.id}
                site={site}
                canRemove={me?.workspace.role === 'owner'}
                onRemoved={() => selectSite(null)}
              />
            </Panel>

            <Panel
              title="Make a trackable link for social posts"
              sub="Use it in your bio, posts and ads so every visit shows the right platform"
            >
              <LinkBuilder key={site.id} defaultUrl={`https://${site.domain}/`} />
            </Panel>
          </div>
        </>
      )}

      <Panel
        title="What the code collects"
        sub="Small, cookie-free, and only on the website it was made for"
      >
        <WhatWeCollect />
      </Panel>

      <AddSiteDialog open={adding} onClose={() => setAdding(false)} />
    </>
  );
}

function PlusIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth="2.6"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
