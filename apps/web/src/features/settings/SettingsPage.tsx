import type { MeResponse, UpdateWorkspaceBody, WorkspaceDto } from '@audience/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '../../components/ui/Button';
import formStyles from '../../components/ui/Form.module.css';
import { Panel } from '../../components/ui/Panel';
import selectStyles from '../../components/ui/Select.module.css';
import { TextField } from '../../components/ui/TextField';
import { useToast } from '../../components/ui/Toast';
import { api } from '../../lib/api';
import { errorMessage, meKey, useLogout, useMe } from '../auth/useAuth';
import styles from './Settings.module.css';

function allTimeZones(current: string): string[] {
  const zones =
    typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [];
  return zones.includes(current) ? zones : [current, ...zones];
}

/** Workspace name and timezone, and the account (§11). */
export function SettingsPage() {
  const { data: me } = useMe();
  if (!me) return null;
  return (
    <>
      <h1>Settings</h1>
      <div className={styles.grid}>
        <WorkspaceForm me={me} />
        <AccountPanel me={me} />
      </div>
    </>
  );
}

function WorkspaceForm({ me }: { me: MeResponse }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [name, setName] = useState(me.workspace.name);
  const [timezone, setTimezone] = useState(me.workspace.timezone);
  const save = useMutation({
    mutationFn: (body: UpdateWorkspaceBody) =>
      api<WorkspaceDto>('/workspace', { method: 'PATCH', body: { ...body } }),
    onSuccess: (workspace) => {
      queryClient.setQueryData<MeResponse | null>(meKey, (prev) =>
        prev ? { ...prev, workspace } : prev,
      );
      toast('Saved');
    },
  });
  const unchanged = name.trim() === me.workspace.name && timezone === me.workspace.timezone;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    save.mutate({ name: name.trim(), timezone });
  }

  return (
    <Panel title="Workspace" sub="Daily, weekly and monthly numbers follow the workspace timezone.">
      <form className={formStyles.form} onSubmit={onSubmit} noValidate>
        <TextField
          label="Workspace name"
          autoComplete="organization"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div className={formStyles.field}>
          <label htmlFor="settings-timezone">Timezone</label>
          <select
            id="settings-timezone"
            className={selectStyles.select}
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
          >
            {allTimeZones(me.workspace.timezone).map((zone) => (
              <option key={zone} value={zone}>
                {zone.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>
        {save.isError && (
          <div className={formStyles.err} role="alert">
            {errorMessage(save.error)}
          </div>
        )}
        <div className={formStyles.actions}>
          <Button
            type="submit"
            variant="dark"
            disabled={unchanged || save.isPending || !name.trim()}
          >
            {save.isPending ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </form>
    </Panel>
  );
}

function AccountPanel({ me }: { me: MeResponse }) {
  const logout = useLogout();
  const navigate = useNavigate();
  return (
    <Panel title="Account">
      <dl className={styles.facts}>
        <dt>Name</dt>
        <dd>{me.user.name}</dd>
        <dt>Email</dt>
        <dd>{me.user.email}</dd>
        <dt>Role</dt>
        <dd>{me.workspace.role === 'owner' ? 'Owner' : 'Member'}</dd>
      </dl>
      <div>
        <Button
          disabled={logout.isPending}
          onClick={() =>
            logout.mutate(undefined, {
              onSettled: () => void navigate('/login', { replace: true }),
            })
          }
        >
          Log out
        </Button>
      </div>
    </Panel>
  );
}
