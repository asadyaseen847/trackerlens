import { EmptyState } from '../../components/ui/EmptyState';

// TODO(Phase 4, §11, §13): 4 tiles, SocialCards, views-per-platform chart, ViewsToVisitsTable.
export function SocialPage() {
  return (
    <>
      <h1>Your social media audience</h1>
      <EmptyState
        title="Built in Phase 4"
        body="Followers, post views and the visits each platform sends arrive with the Social module (sample data first)."
      />
    </>
  );
}
