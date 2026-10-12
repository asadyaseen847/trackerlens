import type { SiteDto } from '@audience/shared';

export interface SiteSettingsProps {
  site: SiteDto;
}

// TODO(Phase 1, §11): count subdomains, pause tracking, "Ignore my visits" link,
// remove website with confirmation.
export function SiteSettings(_props: SiteSettingsProps) {
  return null;
}
