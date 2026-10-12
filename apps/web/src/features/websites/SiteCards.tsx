import type { SiteListItem } from '@audience/shared';

export interface SiteCardsProps {
  sites: ReadonlyArray<SiteListItem>;
  /** 'all' or a site id. */
  selected: string;
  onSelect: (site: string) => void;
  onAdd: () => void;
}

// TODO(Phase 3, §11): "All websites" card, one card per site (status chip, visits, sparkline),
// inverted selected card, "Add website" card last.
export function SiteCards(_props: SiteCardsProps) {
  return null;
}
