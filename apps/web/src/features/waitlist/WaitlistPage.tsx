import {
  BRAND_NAME,
  waitlistBodySchema,
  type WaitlistBody,
  type WaitlistResponse,
} from '@audience/shared';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { Link } from 'react-router';
import { BreakdownRow } from '../../components/breakdown/BreakdownRow';
import breakdownStyles from '../../components/breakdown/Breakdown.module.css';
import { Button } from '../../components/ui/Button';
import formStyles from '../../components/ui/Form.module.css';
import { Panel } from '../../components/ui/Panel';
import { TextField } from '../../components/ui/TextField';
import { api } from '../../lib/api';
import { errorMessage } from '../auth/useAuth';
import styles from './Waitlist.module.css';

/** Example numbers for the preview card. Labeled "Example" on the page. */
const EXAMPLE_ROWS = [
  { name: 'Instagram', color: 'var(--t-social)', value: 3120, changePct: 18 },
  { name: 'Google', color: 'var(--t-search)', value: 2410, changePct: 6 },
  { name: 'Typed in or bookmarked', color: 'var(--t-direct)', value: 1790, changePct: -3 },
  { name: 'ChatGPT', color: 'var(--t-ai)', value: 1480, changePct: 42 },
  { name: 'Newsletter', color: 'var(--t-email)', value: 1200, changePct: 9 },
];
const EXAMPLE_TOTAL = EXAMPLE_ROWS.reduce((sum, r) => sum + r.value, 0);
const EXAMPLE_MAX = Math.max(...EXAMPLE_ROWS.map((r) => r.value)) / EXAMPLE_TOTAL;

const FEATURES = [
  {
    title: 'Count visits, no cookies',
    text: 'One line of code on your website. Every visit is counted, with nothing stored in your visitors’ browsers and no cookie banner needed.',
  },
  {
    title: 'See where they came from',
    text: 'Instagram, TikTok, Google, ChatGPT, a newsletter or typed in. Each platform’s visits, in one clear chart.',
  },
  {
    title: 'Compare social with visits',
    text: 'Connect your social accounts and see which platform’s followers and post views turn into visits to your website.',
  },
];

function useJoinWaitlist() {
  return useMutation({
    mutationFn: (body: WaitlistBody) =>
      api<WaitlistResponse>('/waitlist', { method: 'POST', body: { ...body } }),
  });
}

/** Public waitlist page: what the product does, an example, and the sign-up form. */
export function WaitlistPage() {
  const join = useJoinWaitlist();
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const doneRef = useRef<HTMLDivElement>(null);

  // Move focus to the confirmation so screen readers hear it and keyboard users aren't lost.
  useEffect(() => {
    if (join.isSuccess) doneRef.current?.focus();
  }, [join.isSuccess]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const body = { email, website };
    // Same rules as the server, so most mistakes show without a round trip.
    const check = waitlistBodySchema.safeParse(body);
    if (!check.success) {
      setLocalError(check.error.issues[0]?.message ?? 'Check the form and try again.');
      return;
    }
    setLocalError(null);
    join.mutate(body);
  }

  const error = localError ?? (join.isError ? errorMessage(join.error) : null);

  return (
    <div className={styles.wrap}>
      <section className={styles.hero} aria-labelledby="waitlist-title">
        <div className={styles.intro}>
          <span className={styles.badge}>Opening soon</span>
          <h1 id="waitlist-title">See which platform sends people to your website.</h1>
          <p className={styles.lead}>
            {BRAND_NAME} counts visits to your websites and shows where they came from, without
            cookies. Then it puts your followers and post views next to the visits each platform
            really sends.
          </p>

          <div className={styles.card}>
            {join.isSuccess ? (
              <div className={styles.done} ref={doneRef} tabIndex={-1} role="status">
                <span className={styles.check} aria-hidden="true">
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                  </svg>
                </span>
                <div>
                  <h2>You’re on the list</h2>
                  <p className={styles.sub}>
                    We’ll email <b>{email.trim().toLowerCase()}</b> once when your place opens.
                    Nothing else.
                  </p>
                </div>
              </div>
            ) : (
              <form className={formStyles.form} onSubmit={onSubmit} noValidate>
                <h2>Join the waitlist</h2>
                <TextField
                  label="Work email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <TextField
                  label="Your website (optional)"
                  autoComplete="url"
                  inputMode="url"
                  placeholder="mybrand.com"
                  hint="So we know what you’d like to count."
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                />
                {error && (
                  <div className={formStyles.err} role="alert">
                    {error}
                  </div>
                )}
                <Button type="submit" variant="primary" disabled={join.isPending}>
                  {join.isPending ? 'Adding you…' : 'Join the waitlist'}
                </Button>
                <p className={styles.note}>
                  One email when your place opens. No newsletter, and we never share your email.
                </p>
              </form>
            )}
          </div>
          <p className={styles.switch}>
            Already have an account? <Link to="/login">Log in</Link>
          </p>
        </div>

        <div className={styles.preview}>
          <Panel title="Where visits came from" sub="Last 30 days" actions={<Example />}>
            <ul className={breakdownStyles.rows}>
              {EXAMPLE_ROWS.map((r) => (
                <BreakdownRow
                  key={r.name}
                  name={
                    <>
                      <span
                        className={styles.sw}
                        style={{ '--c': r.color } as CSSProperties}
                        aria-hidden="true"
                      />
                      {r.name}
                    </>
                  }
                  value={r.value}
                  changePct={r.changePct}
                  share={r.value / EXAMPLE_TOTAL}
                  maxShare={EXAMPLE_MAX}
                  color={r.color}
                />
              ))}
            </ul>
            <p className={styles.insight}>
              <b>Instagram</b> sent the most visits (31%). <b>ChatGPT</b> grew the fastest, up 42%.
            </p>
          </Panel>
        </div>
      </section>

      <section className={styles.features} aria-label={`What ${BRAND_NAME} does`}>
        {FEATURES.map((f, i) => (
          <article key={f.title} className={styles.feature}>
            <span className={styles.step} aria-hidden="true">
              {i + 1}
            </span>
            <h2>{f.title}</h2>
            <p>{f.text}</p>
          </article>
        ))}
      </section>

      <Panel title="Private by design" sub="For your visitors and for you">
        <ul className={styles.list}>
          <li>No cookies, and nothing stored in your visitors’ browsers.</li>
          <li>No IP addresses stored, and no following people across websites.</li>
          <li>A tracking code small enough not to slow your website down.</li>
          <li>Your data is never sold or shared.</li>
        </ul>
        <p className={styles.more}>
          <Link to="/privacy">Read exactly what we collect</Link>
        </p>
      </Panel>
    </div>
  );
}

function Example() {
  return <span className={styles.example}>Example</span>;
}
