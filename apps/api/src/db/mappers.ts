import type { SiteDto, SiteListItem, SiteStatus, UserDto, WorkspaceDto } from '@audience/shared';
import type { MemberRow, SiteRow, UserRow, WorkspaceRow } from './repo.js';

export function toUserDto(row: UserRow): UserDto {
  return { id: row.id, email: row.email, name: row.name };
}

export function toWorkspaceDto(row: WorkspaceRow, role: MemberRow['role']): WorkspaceDto {
  return { id: row.id, name: row.name, timezone: row.timezone, role };
}

/** paused wins; otherwise live once the first visit has arrived, else waiting. */
export function siteStatus(row: SiteRow): SiteStatus {
  if (row.paused) return 'paused';
  return row.last_event_at ? 'live' : 'waiting';
}

export function toSiteDto(row: SiteRow): SiteDto {
  return {
    id: row.id,
    domain: row.domain,
    siteKey: row.site_key,
    settings: {
      includeSubdomains: row.include_subdomains,
      paused: row.paused,
      allowLocalhost: row.allow_localhost,
    },
    status: siteStatus(row),
    firstEventAt: row.first_event_at,
    lastEventAt: row.last_event_at,
    createdAt: row.created_at,
  };
}

export function toSiteListItem(
  row: SiteRow,
  stats: { visits30d: number; sparkline: number[] } | undefined,
): SiteListItem {
  return {
    ...toSiteDto(row),
    visits30d: stats?.visits30d ?? 0,
    sparkline: stats?.sparkline ?? Array.from({ length: 14 }, () => 0),
  };
}
