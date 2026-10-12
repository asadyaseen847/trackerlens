import { Link } from 'react-router';
import { EmptyState } from '../../components/ui/EmptyState';

// TODO(Phase 1, §10, §11): name, email, password; creates the workspace with the browser's
// timezone, then goes to /onboarding.
export function SignupPage() {
  return (
    <>
      <h1>Create your account</h1>
      <EmptyState
        title="Built in Phase 1"
        body={
          <>
            Sign-up arrives with Accounts & sites. <Link to="/login">Log in instead</Link>
          </>
        }
      />
    </>
  );
}
