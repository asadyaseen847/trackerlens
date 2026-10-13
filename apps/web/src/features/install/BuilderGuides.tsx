import { useState, type ReactNode } from 'react';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import styles from './Install.module.css';

export type Builder = 'any' | 'wordpress' | 'shopify' | 'webflow' | 'wix' | 'gtm';

const BUILDERS: ReadonlyArray<{ value: Builder; label: string; steps: ReactNode[] }> = [
  {
    value: 'any',
    label: 'Any website',
    steps: [
      'Open the template that every page uses (often called header, layout or base).',
      <>
        Paste the code just before the closing <code>&lt;/head&gt;</code> tag. The footer, before{' '}
        <code>&lt;/body&gt;</code>, works too.
      </>,
      'Save and publish your site.',
    ],
  },
  {
    value: 'wordpress',
    label: 'WordPress',
    steps: [
      'Install a header and footer plugin, such as WPCode.',
      'Open its Header & Footer page and paste the code into the Header box.',
      'Click Save.',
    ],
  },
  {
    value: 'shopify',
    label: 'Shopify',
    steps: [
      'Go to Online Store → Themes, open the menu next to your theme and choose Edit code.',
      <>
        Open <code>layout/theme.liquid</code> and paste the code just before{' '}
        <code>&lt;/head&gt;</code>.
      </>,
      'Click Save.',
    ],
  },
  {
    value: 'webflow',
    label: 'Webflow',
    steps: [
      'Open Site settings → Custom code.',
      'Paste the code into Head code.',
      'Save, then publish the site.',
    ],
  },
  {
    value: 'wix',
    label: 'Wix',
    steps: [
      'Open Settings → Custom code and click Add custom code.',
      'Paste the code, choose All pages and place it in Head.',
      'Click Apply.',
    ],
  },
  {
    value: 'gtm',
    label: 'Google Tag Manager',
    steps: [
      'Create a new tag of type Custom HTML and paste the code.',
      'Set the trigger to All Pages.',
      'Submit and publish the container.',
    ],
  },
];

export interface BuilderGuidesProps {
  initial?: Builder;
}

/** Paste steps per website builder, exactly as in the prototype (§11). */
export function BuilderGuides({ initial = 'any' }: BuilderGuidesProps) {
  const [builder, setBuilder] = useState<Builder>(initial);
  const current = BUILDERS.find((b) => b.value === builder) ?? BUILDERS[0];

  return (
    <>
      <SegmentedControl
        label="Website builder"
        size="small"
        options={BUILDERS}
        value={builder}
        onChange={setBuilder}
      />
      <ol className={styles.guide}>
        {current?.steps.map((step, i) => (
          <li key={i}>{step}</li>
        ))}
      </ol>
    </>
  );
}
