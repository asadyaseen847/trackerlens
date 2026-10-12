import { EmptyState } from '../components/ui/EmptyState';

// TODO(Phase 6, §14): public privacy page in plain language, matching "What the code collects".
export function PrivacyPage() {
  return (
    <>
      <h1>Privacy</h1>
      <EmptyState
        title="Built in Phase 6"
        body="A plain-language explanation of what the tracking code collects, and what it never does."
      />
    </>
  );
}
