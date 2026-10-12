import type { StatsFilters } from '@audience/shared';

export interface FilterBarProps {
  filters: StatsFilters;
  onChange: (filters: StatsFilters) => void;
}

// TODO(Phase 3, §11): device select, country select, channel chips (at least one stays on),
// "Show all" when some are off.
export function FilterBar(_props: FilterBarProps) {
  return null;
}
