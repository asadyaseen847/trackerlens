import { signupBodySchema } from '@audience/shared';
import { useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router';
import { Button } from '../../components/ui/Button';
import formStyles from '../../components/ui/Form.module.css';
import { TextField } from '../../components/ui/TextField';
import styles from './Auth.module.css';
import { browserTimeZone, errorMessage, useMe, useSignup } from './useAuth';

export function SignupPage() {
  const { data: me } = useMe();
  const signup = useSignup();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const timezone = browserTimeZone();

  // A brand-new account goes to onboarding; someone already signed in goes to the dashboard.
  if (me) return <Navigate to={signup.isSuccess ? '/onboarding' : '/app/websites'} replace />;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const body = { name, email, password, timezone };
    // Same rules as the server, so most mistakes show without a round trip.
    const check = signupBodySchema.safeParse(body);
    if (!check.success) {
      setLocalError(check.error.issues[0]?.message ?? 'Check the form and try again.');
      return;
    }
    setLocalError(null);
    // On success the cached user appears and the <Navigate> above takes over.
    signup.mutate(body);
  }

  const error = localError ?? (signup.isError ? errorMessage(signup.error) : null);

  return (
    <div className={styles.wrap}>
      <section className={styles.card} aria-labelledby="signup-title">
        <div>
          <h1 id="signup-title">Create your account</h1>
          <p className={styles.sub}>Free to start. No cookies on your visitors, ever.</p>
        </div>
        <form className={formStyles.form} onSubmit={onSubmit} noValidate>
          <TextField
            label="Your name"
            autoComplete="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <TextField
            label="Work email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <TextField
            label="Password"
            type="password"
            autoComplete="new-password"
            required
            hint="At least 8 characters."
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <p className={formStyles.hint}>
            Your timezone: <b>{timezone}</b>. Daily numbers follow it; you can change it later.
          </p>
          {error && (
            <div className={formStyles.err} role="alert">
              {error}
            </div>
          )}
          <Button type="submit" variant="primary" disabled={signup.isPending}>
            {signup.isPending ? 'Creating your account…' : 'Create account'}
          </Button>
        </form>
        <p className={styles.switch}>
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </section>
    </div>
  );
}
