import { Link } from 'react-router';
import buttonStyles from '../components/ui/Button.module.css';
import { EmptyState } from '../components/ui/EmptyState';

export function NotFoundPage() {
  return (
    <>
      <h1>Page not found</h1>
      <EmptyState
        title="We couldn’t find that page"
        body="The link may be old or mistyped."
        action={
          <Link to="/app/websites" className={buttonStyles.btn}>
            Go to your dashboard
          </Link>
        }
      />
    </>
  );
}
