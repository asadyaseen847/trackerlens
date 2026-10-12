import { EmptyState } from '../../components/ui/EmptyState';

// TODO(Phase 1, §11): workspace name and timezone, account.
export function SettingsPage() {
  return (
    <>
      <h1>Settings</h1>
      <EmptyState
        title="Built in Phase 1"
        body="Workspace name, timezone and your account arrive with Accounts & sites."
      />
    </>
  );
}
