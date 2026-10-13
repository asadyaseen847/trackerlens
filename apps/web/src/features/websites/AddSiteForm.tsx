import { checkDomainInput, type SiteDto } from '@audience/shared';
import { forwardRef, useState, type FormEvent, type ReactNode } from 'react';
import { Button } from '../../components/ui/Button';
import formStyles from '../../components/ui/Form.module.css';
import { TextField } from '../../components/ui/TextField';
import { errorMessage } from '../auth/useAuth';
import { useCreateSite } from './queries';

export interface AddSiteFormProps {
  onCreated: (site: SiteDto) => void;
  /** Extra buttons before the submit button, e.g. Cancel. */
  secondaryAction?: ReactNode;
}

/** Website address field with the prototype's inline messages; creates the site on submit. */
export const AddSiteForm = forwardRef<HTMLInputElement, AddSiteFormProps>(function AddSiteForm(
  { onCreated, secondaryAction },
  inputRef,
) {
  const createSite = useCreateSite();
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const check = checkDomainInput(value);
    if (!check.ok) {
      setError(check.error);
      return;
    }
    setError(null);
    createSite.mutate(
      { domain: check.domain },
      { onSuccess: onCreated, onError: (err) => setError(errorMessage(err)) },
    );
  }

  return (
    <form className={formStyles.form} onSubmit={onSubmit} noValidate>
      <TextField
        ref={inputRef}
        label="Website address"
        placeholder="shop.example.com"
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        inputMode="url"
        value={value}
        error={error}
        onChange={(e) => setValue(e.target.value)}
      />
      <div className={formStyles.actions}>
        {secondaryAction}
        <Button type="submit" variant="primary" disabled={createSite.isPending}>
          {createSite.isPending ? 'Creating…' : 'Create tracking code'}
        </Button>
      </div>
    </form>
  );
});
