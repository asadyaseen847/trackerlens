import { useState } from 'react';
import { Link } from 'react-router';
import buttonStyles from '../../components/ui/Button.module.css';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { Skeleton } from '../../components/ui/Skeleton';
import { AddSiteDialog } from './AddSiteDialog';
import { useSites } from './queries';

// TODO(Phase 3, §11): insight sentence, period switch, SiteCards, FilterBar, KpiRow,
// stacked chart with table view, breakdown panels, "Waiting for the first visit" state.
export function WebsitesPage() {
  const { data: sites, isPending } = useSites();
  const [adding, setAdding] = useState(false);

  return (
    <>
      <h1>Your website traffic</h1>
      {isPending ? (
        <Skeleton height={150} radius={22} />
      ) : !sites?.length ? (
        <EmptyState
          title="Add your first website"
          body="Type its address and you’ll get a one-line code to paste into the site. Visits show up here once it’s installed."
          action={
            <Button variant="primary" onClick={() => setAdding(true)}>
              Add website
            </Button>
          }
        />
      ) : (
        <EmptyState
          title="Charts arrive in Phase 3"
          body={`You have ${sites.length} ${sites.length === 1 ? 'website' : 'websites'}. Visits per platform, the chart, filters and breakdowns come with the Websites dashboard.`}
          action={
            <Link to="/app/install" className={buttonStyles.btn}>
              Get the code
            </Link>
          }
        />
      )}
      <AddSiteDialog open={adding} onClose={() => setAdding(false)} />
    </>
  );
}
