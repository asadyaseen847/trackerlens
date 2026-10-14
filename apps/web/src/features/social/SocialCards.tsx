import {
  SOCIAL_PLATFORMS,
  type SocialPlatform,
  type SocialPlatformSummary,
} from '@audience/shared';
import { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { StatusChip } from '../../components/ui/StatusChip';
import { useToast } from '../../components/ui/Toast';
import { formatBig, formatNumber } from '../../lib/format';
import { errorMessage } from '../auth/useAuth';
import { startConnect, useDisconnect } from './queries';
import styles from './Social.module.css';

/** What we can read from each platform, in plain words (from the prototype). */
export const WHAT_WE_READ: Record<SocialPlatform, string> = {
  instagram:
    'Followers, reach, profile visits and link taps. Needs an Instagram Business or Creator account.',
  facebook: 'Page followers, reach and link clicks from a Facebook Page.',
  youtube: 'Subscribers, video views and watch time for your channel.',
  linkedin: 'Company page followers, impressions and clicks.',
  tiktok: 'Followers and video views from a TikTok Business account.',
  x: 'Followers and post views. X may charge for API access.',
};

const META = new Map(SOCIAL_PLATFORMS.map((p) => [p.id, p]));

export interface SocialCardsProps {
  platforms: ReadonlyArray<SocialPlatformSummary>;
  /** Platforms that can be connected now; the others say "Coming soon". */
  available: ReadonlyArray<SocialPlatform>;
}

/**
 * One card per platform (§11): connected cards show followers, the change, views, engagement
 * and site visits; unconnected ones say what we can read and offer Connect, or say "Coming
 * soon" while that platform's real connection isn't built yet.
 */
export function SocialCards({ platforms, available }: SocialCardsProps) {
  const toast = useToast();
  const disconnect = useDisconnect();
  const [confirming, setConfirming] = useState<SocialPlatformSummary | null>(null);

  return (
    <div className={styles.socials}>
      {platforms.map((p) => {
        const meta = META.get(p.platform);
        const name = meta?.label ?? p.platform;
        const swatch = (
          <span className={styles.sw} style={{ background: `var(${meta?.cssVar})` }} />
        );

        if (!p.account) {
          const canConnect = available.includes(p.platform);
          return (
            <div key={p.platform} className={`${styles.soc} ${styles.off}`}>
              <div className={styles.top}>
                <span className={styles.name}>
                  {swatch}
                  {name}
                </span>
                <StatusChip status="waiting" label={canConnect ? 'Not connected' : 'Coming soon'} />
              </div>
              <p className={styles.what}>{WHAT_WE_READ[p.platform]}</p>
              <div>
                {canConnect ? (
                  <Button variant="dark" onClick={() => startConnect(p.platform)}>
                    Connect {name}
                  </Button>
                ) : (
                  <Button disabled title={`Connecting ${name} is coming soon`}>
                    Coming soon
                  </Button>
                )}
              </div>
            </div>
          );
        }

        const needsReconnect = p.account.status === 'needs_reconnect';
        return (
          <div key={p.platform} className={styles.soc}>
            <div className={styles.top}>
              <span className={styles.name}>
                {swatch}
                <span>
                  {name}
                  <br />
                  <span className={styles.handle}>@{p.account.handle}</span>
                </span>
              </span>
              {needsReconnect ? (
                <StatusChip status="waiting" label="Reconnect" />
              ) : (
                <StatusChip status="live" label="Connected" />
              )}
            </div>
            <div>
              <div className={styles.big}>
                {p.followers === null ? '–' : formatNumber(p.followers)}
              </div>
              <div className={styles.handle}>
                {p.platform === 'youtube' ? 'subscribers' : 'followers'} ·{' '}
                <b>
                  {p.newFollowers >= 0 ? '+' : '−'}
                  {formatNumber(Math.abs(p.newFollowers))}
                </b>{' '}
                in this period
              </div>
            </div>
            <div className={styles.stats}>
              <div>
                <span>Views</span>
                <b>{formatBig(p.views)}</b>
              </div>
              <div>
                <span>Engagement</span>
                <b>{p.engagementRate === null ? '–' : `${p.engagementRate.toFixed(1)}%`}</b>
              </div>
              <div>
                <span>Site visits</span>
                <b>{formatBig(p.visits)}</b>
              </div>
            </div>
            <p className={styles.what}>{WHAT_WE_READ[p.platform]}</p>
            <div>
              {needsReconnect ? (
                <Button variant="dark" onClick={() => startConnect(p.platform)}>
                  Reconnect {name}
                </Button>
              ) : (
                <Button variant="danger" onClick={() => setConfirming(p)}>
                  Disconnect
                </Button>
              )}
            </div>
          </div>
        );
      })}

      <Dialog
        open={confirming !== null}
        onClose={() => setConfirming(null)}
        title={`Disconnect ${confirming ? (META.get(confirming.platform)?.label ?? '') : ''}?`}
        actions={
          <>
            <Button onClick={() => setConfirming(null)}>Keep it</Button>
            <Button
              variant="dark"
              disabled={disconnect.isPending}
              onClick={() => {
                if (!confirming?.account) return;
                const label = META.get(confirming.platform)?.label ?? confirming.platform;
                disconnect.mutate(confirming.account.id, {
                  onSuccess: () => {
                    toast(`${label} disconnected`);
                    setConfirming(null);
                  },
                  onError: (err) => toast(errorMessage(err)),
                });
              }}
            >
              Disconnect
            </Button>
          </>
        }
      >
        <p className={styles.what}>
          We stop reading its numbers and delete the ones we stored. You can connect it again any
          time.
        </p>
      </Dialog>
    </div>
  );
}
