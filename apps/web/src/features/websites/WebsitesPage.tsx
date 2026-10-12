import { EmptyState } from '../../components/ui/EmptyState';

// TODO(Phase 3, §11): insight sentence, period switch, SiteCards, FilterBar, KpiRow,
// stacked chart with table view, breakdown panels, "Waiting for the first visit" state.
export function WebsitesPage() {
  return (
    <>
      <h1>Your website traffic</h1>
      <EmptyState
        title="Built in Phase 3"
        body="Visits per platform, the chart, filters and breakdowns arrive with the Websites dashboard."
      />
    </>
  );
}
