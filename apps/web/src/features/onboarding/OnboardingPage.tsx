import type { MeResponse, SiteDto, WorkspaceDto } from '@audience/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import buttonStyles from '../../components/ui/Button.module.css';
import { Button } from '../../components/ui/Button';
import formStyles from '../../components/ui/Form.module.css';
import { Panel } from '../../components/ui/Panel';
import { TextField } from '../../components/ui/TextField';
import { api } from '../../lib/api';
import { errorMessage, meKey, useMe } from '../auth/useAuth';
import { SnippetBox } from '../install/SnippetBox';
import { AddSiteForm } from '../websites/AddSiteForm';
import styles from './Onboarding.module.css';

type Step = 'workspace' | 'site' | 'code';

/** Name the workspace, add the first website, show the code (§11). */
export function OnboardingPage() {
  const { data: me } = useMe();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('workspace');
  const [site, setSite] = useState<SiteDto | null>(null);

  return (
    <div className={styles.wrap}>
      <ol className={styles.steps} aria-label="Setup steps">
        {(['workspace', 'site', 'code'] as const).map((s, i) => (
          <li
            key={s}
            aria-current={s === step ? 'step' : undefined}
            className={s === step ? styles.on : undefined}
          >
            {i + 1} · {s === 'workspace' ? 'Workspace' : s === 'site' ? 'Website' : 'Code'}
          </li>
        ))}
      </ol>

      {step === 'workspace' && me && <WorkspaceStep me={me} onDone={() => setStep('site')} />}

      {step === 'site' && (
        <Panel
          title="Add your first website"
          sub="The address people type to visit it, like shop.example.com"
        >
          <AddSiteForm
            onCreated={(created) => {
              setSite(created);
              setStep('code');
            }}
            secondaryAction={
              <Link to="/app/install" className={buttonStyles.btn}>
                Skip for now
              </Link>
            }
          />
        </Panel>
      )}

      {step === 'code' && site && (
        <Panel
          title={`Paste this on ${site.domain}`}
          sub="Put it in the global header or footer so it runs on every page"
        >
          <SnippetBox site={site} autoFocusCopy />
          <div className={formStyles.actions}>
            <Button onClick={() => void navigate(`/app/install?site=${site.id}`)}>
              Show install steps
            </Button>
            <Button variant="primary" onClick={() => void navigate('/app/websites')}>
              Go to dashboard
            </Button>
          </div>
        </Panel>
      )}
    </div>
  );
}

function WorkspaceStep({ me, onDone }: { me: MeResponse; onDone: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(me.workspace.name);
  const rename = useMutation({
    mutationFn: (body: { name: string }) =>
      api<WorkspaceDto>('/workspace', { method: 'PATCH', body }),
    onSuccess: (workspace) => {
      queryClient.setQueryData<MeResponse | null>(meKey, (prev) =>
        prev ? { ...prev, workspace } : prev,
      );
      onDone();
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (name.trim() === me.workspace.name) return onDone();
    rename.mutate({ name: name.trim() });
  }

  return (
    <Panel
      title="Name your workspace"
      sub="Usually your company or brand. Your websites live inside it."
    >
      <form className={formStyles.form} onSubmit={onSubmit} noValidate>
        <TextField
          label="Workspace name"
          autoComplete="organization"
          value={name}
          error={rename.isError ? errorMessage(rename.error) : null}
          onChange={(e) => setName(e.target.value)}
        />
        <div className={formStyles.actions}>
          <Button type="submit" variant="primary" disabled={rename.isPending || !name.trim()}>
            {rename.isPending ? 'Saving…' : 'Continue'}
          </Button>
        </div>
      </form>
    </Panel>
  );
}
