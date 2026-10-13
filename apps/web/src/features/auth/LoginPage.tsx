import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import { Button } from '../../components/ui/Button';
import formStyles from '../../components/ui/Form.module.css';
import { TextField } from '../../components/ui/TextField';
import styles from './Auth.module.css';
import { errorMessage, useLogin, useMe } from './useAuth';

export function LoginPage() {
  const { data: me } = useMe();
  const login = useLogin();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/app/websites';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  if (me && !login.isPending) return <Navigate to={from} replace />;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    login.mutate({ email, password }, { onSuccess: () => void navigate(from, { replace: true }) });
  }

  return (
    <div className={styles.wrap}>
      <section className={styles.card} aria-labelledby="login-title">
        <div>
          <h1 id="login-title">Log in</h1>
          <p className={styles.sub}>
            See how many people visit your websites, and where they came from.
          </p>
        </div>
        <form className={formStyles.form} onSubmit={onSubmit} noValidate>
          <TextField
            label="Email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <TextField
            label="Password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {login.isError && (
            <div className={formStyles.err} role="alert">
              {errorMessage(login.error)}
            </div>
          )}
          <Button type="submit" variant="primary" disabled={login.isPending}>
            {login.isPending ? 'Logging in…' : 'Log in'}
          </Button>
        </form>
        <p className={styles.switch}>
          New here? <Link to="/signup">Create an account</Link>
        </p>
      </section>
    </div>
  );
}
