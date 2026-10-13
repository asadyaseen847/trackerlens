import { BRAND_NAME, IGNORE_PARAM } from '@audience/shared';
import { Link } from 'react-router';
import { Panel } from '../components/ui/Panel';
import { WhatWeCollect } from '../features/install/WhatWeCollect';
import styles from './Privacy.module.css';

/** Public privacy page in plain language (§14). Matches "What the code collects". */
export function PrivacyPage() {
  return (
    <div className={styles.wrap}>
      <h1>Privacy</h1>
      <p className={styles.lead}>
        {BRAND_NAME} counts visits to websites and shows where they came from. It is built to do
        that without following people around.
      </p>

      <Panel
        title="What the tracking code collects"
        sub="Small, cookie-free, and only on the website it was made for"
      >
        <WhatWeCollect />
      </Panel>

      <Panel title="What it never does">
        <ul className={styles.list}>
          <li>No cookies, and nothing stored in the visitor’s browser.</li>
          <li>
            No IP addresses stored. The IP is used for a moment to tell visitors apart, then
            forgotten.
          </li>
          <li>No names, emails, form contents or anything typed on the page.</li>
          <li>No following people across websites, and no selling or sharing of data.</li>
          <li>No ads, no revenue or payment tracking.</li>
        </ul>
      </Panel>

      <Panel title="How visitors are counted without cookies">
        <p className={styles.text}>
          For each visit we make a short code from a random value that changes every day, the
          website, the IP address and the browser name. Only the code is kept. The daily random
          value is deleted after two days, so the code can’t be turned back into an IP address or
          linked to the same person on another day. That is also why one person who visits on three
          different days counts as three visitors.
        </p>
      </Panel>

      <Panel title="How long data is kept">
        <p className={styles.text}>
          Visit data is kept for 25 months by default and then deleted automatically. Website owners
          can remove a website at any time, which deletes all of its visits.
        </p>
      </Panel>

      <Panel title="For website owners">
        <ul className={styles.list}>
          <li>
            To stop counting your own visits, open your website once with{' '}
            <code>?{IGNORE_PARAM}=1</code> at the end of the address, in each browser you use.
          </li>
          <li>
            Connected social accounts: we read your follower and view numbers only. Login tokens are
            encrypted, and disconnecting deletes them.
          </li>
          <li>
            Your dashboard login uses one secure cookie on this website, only to keep you signed in.
          </li>
        </ul>
      </Panel>

      <p className={styles.text}>
        <Link to="/login">Back to {BRAND_NAME}</Link>
      </p>
    </div>
  );
}
