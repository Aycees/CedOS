"use client";

import { useState } from "react";

import { Button } from "@/core/ui/button";
import { PageHeader } from "@/core/ui/page-header";

import type { VaultSettingsView } from "../schema";
import { CredentialList } from "./credential-list";
import { CredentialModal } from "./credential-modal";
import { SecurityPanel } from "./security-panel";
import { lock, useVaultSession, type VaultItemDecrypted } from "./session";
import { useAutoLock } from "./use-auto-lock";

export function VaultUnlocked({
  settings,
  onSettingsChanged,
}: {
  settings: VaultSettingsView;
  onSettingsChanged: () => void;
}) {
  const { items } = useVaultSession();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<VaultItemDecrypted | null>(null);
  const [securityOpen, setSecurityOpen] = useState(false);

  const { warning, stillHere } = useAutoLock();

  return (
    <>
      <PageHeader
        kicker={`VAULT · ${items.length} SAVED`}
        title="Vault"
        actions={
          <>
            <Button variant="outline" onClick={() => setSecurityOpen(true)}>
              security
            </Button>
            <Button variant="outline" onClick={() => lock()}>
              lock now
            </Button>
            <Button onClick={() => setCreating(true)}>+ new credential</Button>
          </>
        }
      />

      <div className="flex-1 overflow-auto p-8">
        {warning && (
          <div className="mb-5 flex max-w-180 items-center gap-3 rounded-input border border-border-strong px-4 py-3 font-mono text-[11.5px]">
            <span>Still there? Locking soon from inactivity.</span>
            <Button size="sm" variant="outline" className="ml-auto" onClick={stillHere}>
              I&rsquo;m here
            </Button>
          </div>
        )}

        <CredentialList items={items} onEdit={setEditing} onNew={() => setCreating(true)} />
      </div>

      {(creating || editing) && (
        <CredentialModal
          item={editing}
          items={items}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}

      {securityOpen && settings && (
        <SecurityPanel
          settings={settings}
          onClose={() => setSecurityOpen(false)}
          onSettingsChanged={() => {
            setSecurityOpen(false);
            onSettingsChanged();
          }}
        />
      )}
    </>
  );
}
