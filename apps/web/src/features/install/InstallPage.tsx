import { EmptyState } from '../../components/ui/EmptyState';

// TODO(Phase 1, §11): site selector, SnippetBox, BuilderGuides, SiteSettings, LinkBuilder,
// WhatWeCollect. TODO(Phase 2, §11): "Check installation".
export function InstallPage() {
  return (
    <>
      <h1>Install the tracking code</h1>
      <EmptyState
        title="Built in Phase 1"
        body="Your code, paste guides for each website builder, site settings and the trackable link builder arrive with Accounts & sites."
      />
    </>
  );
}
