import { SOCIAL_PLATFORMS, type SocialOverviewResponse } from '@audience/shared';
import { formatNumber } from '../../lib/format';
import styles from './Social.module.css';

const META = new Map(SOCIAL_PLATFORMS.map((p) => [p.id, p]));

export interface ViewsToVisitsTableProps {
  rows: SocialOverviewResponse['viewsToVisits'];
}

/** "From social post to website visit", best visits-per-1,000-views first, with a Best badge (§11). */
export function ViewsToVisitsTable({ rows }: ViewsToVisitsTableProps) {
  if (rows.length === 0) return <p className={styles.what}>No connected accounts yet.</p>;
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <caption className="sr-only">Post views and website visits per platform</caption>
        <thead>
          <tr>
            <th scope="col">Platform</th>
            <th scope="col">Post views</th>
            <th scope="col">Visits to your websites</th>
            <th scope="col">Visits per 1,000 views</th>
            <th scope="col">New followers</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.platform}>
              <th scope="row" style={{ fontWeight: 600 }}>
                <span
                  className={styles.sw}
                  style={{
                    background: `var(${META.get(r.platform)?.cssVar})`,
                    marginRight: 8,
                    width: 10,
                    height: 10,
                  }}
                />
                {META.get(r.platform)?.label ?? r.platform}
              </th>
              <td>{formatNumber(r.views)}</td>
              <td>{formatNumber(r.visits)}</td>
              <td>
                <b>{r.visitsPer1000Views.toFixed(1)}</b>
                {i === 0 && rows.length > 1 && <span className={styles.best}>Best</span>}
              </td>
              <td>{formatNumber(r.newFollowers)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
