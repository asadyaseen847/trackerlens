import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import styles from './Tabs.module.css';

interface TabDef {
  id: string;
  to: string;
  label: string;
  icon: ReactNode;
}

const iconProps = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  strokeWidth: 2.2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const;

export const TABS: readonly TabDef[] = [
  {
    id: 'tab-websites',
    to: '/app/websites',
    label: 'Websites',
    icon: (
      <svg {...iconProps}>
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
      </svg>
    ),
  },
  {
    id: 'tab-social',
    to: '/app/social',
    label: 'Social media',
    icon: (
      <svg {...iconProps}>
        <circle cx="9" cy="8" r="3.5" />
        <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
        <circle cx="17.5" cy="9" r="2.5" />
        <path d="M17 14a5 5 0 0 1 4.5 5" />
      </svg>
    ),
  },
  {
    id: 'tab-install',
    to: '/app/install',
    label: 'Install code',
    icon: (
      <svg {...iconProps}>
        <path d="M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16" />
      </svg>
    ),
  },
];

export function activeTab(pathname: string): TabDef | undefined {
  return TABS.find((t) => pathname === t.to || pathname.startsWith(`${t.to}/`));
}

/** Route-backed tabs with ARIA tab semantics: roving tabindex, arrow keys, Home and End. */
export function Tabs() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const refs = useRef<Array<HTMLAnchorElement | null>>([]);
  const current = activeTab(pathname);
  const currentIndex = current ? TABS.indexOf(current) : -1;

  function onKeyDown(event: KeyboardEvent<HTMLAnchorElement>, index: number) {
    const last = TABS.length - 1;
    const next =
      event.key === 'ArrowRight'
        ? (index + 1) % TABS.length
        : event.key === 'ArrowLeft'
          ? (index - 1 + TABS.length) % TABS.length
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? last
              : null;
    if (next === null) return;
    event.preventDefault();
    const tab = TABS[next];
    if (!tab) return;
    refs.current[next]?.focus();
    void navigate(tab.to);
  }

  return (
    <div className={styles.tabs} role="tablist" aria-label="Sections">
      {TABS.map((tab, i) => {
        const selected = i === currentIndex;
        const focusable = selected || (currentIndex === -1 && i === 0);
        return (
          <Link
            key={tab.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            to={tab.to}
            id={tab.id}
            role="tab"
            aria-selected={selected}
            aria-controls={selected ? 'app-panel' : undefined}
            tabIndex={focusable ? 0 : -1}
            className={styles.tab}
            onKeyDown={(e) => onKeyDown(e, i)}
          >
            {tab.icon}
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
