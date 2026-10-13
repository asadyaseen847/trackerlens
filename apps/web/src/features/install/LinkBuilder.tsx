import { useRef, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { CodeBox } from '../../components/ui/CodeBox';
import formStyles from '../../components/ui/Form.module.css';
import { TextField } from '../../components/ui/TextField';
import { useToast } from '../../components/ui/Toast';
import { COPY_MESSAGES, copyText } from '../../lib/clipboard';
import selectStyles from '../../components/ui/Select.module.css';

const PLATFORMS = [
  ['instagram', 'Instagram'],
  ['facebook', 'Facebook'],
  ['tiktok', 'TikTok'],
  ['x', 'X / Twitter'],
  ['linkedin', 'LinkedIn'],
  ['youtube', 'YouTube'],
  ['newsletter', 'Email newsletter'],
] as const;

const INVALID = 'Enter a full page link, like https://mybrand.com/sale';

/** Page link + platform + campaign name → link with UTM tags (§11), built in the browser. */
export function buildTrackableLink(url: string, platform: string, campaign: string): string | null {
  const slug =
    campaign
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'campaign';
  try {
    const trimmed = url.trim();
    const u = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    if (!u.hostname.includes('.')) return null;
    u.searchParams.set('utm_source', platform);
    u.searchParams.set('utm_medium', platform === 'newsletter' ? 'email' : 'social');
    u.searchParams.set('utm_campaign', slug);
    return u.toString();
  } catch {
    return null;
  }
}

export interface LinkBuilderProps {
  defaultUrl: string;
}

export function LinkBuilder({ defaultUrl }: LinkBuilderProps) {
  const toast = useToast();
  const outRef = useRef<HTMLPreElement>(null);
  const [url, setUrl] = useState(defaultUrl);
  const [platform, setPlatform] = useState<string>('instagram');
  const [campaign, setCampaign] = useState('october-sale');
  const link = buildTrackableLink(url, platform, campaign);

  return (
    <>
      <div className={formStyles.form}>
        <TextField
          label="Page link"
          type="url"
          inputMode="url"
          autoComplete="off"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <div className={formStyles.field}>
          <label htmlFor="link-platform">Where you’ll share it</label>
          <select
            id="link-platform"
            className={selectStyles.select}
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
          >
            {PLATFORMS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <TextField
          label="Campaign name"
          autoComplete="off"
          value={campaign}
          onChange={(e) => setCampaign(e.target.value)}
        />
      </div>
      <CodeBox ref={outRef} code={link ?? INVALID} label="Trackable link" wrap />
      <div>
        <Button
          variant="dark"
          disabled={!link}
          onClick={() =>
            link && void copyText(link, outRef.current).then((r) => toast(COPY_MESSAGES[r]))
          }
        >
          Copy link
        </Button>
      </div>
    </>
  );
}
