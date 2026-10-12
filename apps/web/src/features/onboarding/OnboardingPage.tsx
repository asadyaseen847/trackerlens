import { EmptyState } from '../../components/ui/EmptyState';

// TODO(Phase 1, §11): name the workspace, add the first website, show the code.
export function OnboardingPage() {
  return (
    <>
      <h1>Let’s get you set up</h1>
      <EmptyState
        title="Built in Phase 1"
        body="Name your workspace, add your first website and get its code."
      />
    </>
  );
}
