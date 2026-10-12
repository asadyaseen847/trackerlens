import { Link } from 'react-router';
import { EmptyState } from '../../components/ui/EmptyState';

// TODO(Phase 1, §10, §11): email + password form, friendly errors, redirect to /app/websites.
export function LoginPage() {
  return (
    <>
      <h1>Log in</h1>
      <EmptyState
        title="Built in Phase 1"
        body={
          <>
            Email and password sign-in arrives with Accounts & sites.{' '}
            <Link to="/signup">Create an account</Link>
          </>
        }
      />
    </>
  );
}
