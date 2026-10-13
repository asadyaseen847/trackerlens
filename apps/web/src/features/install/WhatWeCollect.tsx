import styles from './Install.module.css';

/** "What the code collects", in plain words (§11). Keep in sync with the /privacy page. */
export function WhatWeCollect() {
  return (
    <ul className={styles.facts}>
      <li>The page address, and the site or app the visitor came from</li>
      <li>Campaign tags on the link, like utm_source=instagram</li>
      <li>Screen size, to tell phones from desktops</li>
      <li>Country, worked out on our server. The visitor’s IP address is never stored.</li>
      <li>No cookies and no personal details. Bots are filtered out.</li>
    </ul>
  );
}
