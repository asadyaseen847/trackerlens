import type { SocialOverviewResponse } from '@audience/shared';

export interface ViewsToVisitsTableProps {
  rows: SocialOverviewResponse['viewsToVisits'];
}

// TODO(Phase 4, §11): "From social post to website visit" with a "Best" badge on the top row.
export function ViewsToVisitsTable(_props: ViewsToVisitsTableProps) {
  return null;
}
