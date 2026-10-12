import type { SocialAccountDto } from '@audience/shared';

export interface SocialCardsProps {
  accounts: ReadonlyArray<SocialAccountDto>;
}

// TODO(Phase 4, §11): connected cards (followers, change, views, engagement, site visits);
// unconnected cards (what we can read + Connect button).
export function SocialCards(_props: SocialCardsProps) {
  return null;
}
