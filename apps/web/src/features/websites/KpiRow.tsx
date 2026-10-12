import type { OverviewResponse } from '@audience/shared';

export interface KpiRowProps {
  kpis: OverviewResponse['kpis'] | undefined;
  siteId: string;
}

// TODO(Phase 3, §11): Visits (lime), Unique visitors (info tooltip), Pages viewed, LiveCounter.
export function KpiRow(_props: KpiRowProps) {
  return null;
}
