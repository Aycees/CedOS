"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { api } from "@/core/mutation/client";
import { Card } from "@/core/ui/card";
import { Input, Textarea } from "@/core/ui/input";
import type { ProfileView } from "../schema";

/**
 * Product spec §12.1: every field is editable in place. There is no separate
 * edit mode or modal here, unlike every other app's create/edit flow — this
 * is a single record, not a list.
 *
 * Fields save on blur. Age is never an input: it is derived from birthday at
 * render (see the server component), so it cannot go stale.
 */
export function ProfilePage({ initial, age }: { initial: ProfileView; age: number | null }) {
  const router = useRouter();
  const [profile, setProfile] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  const save = async (patch: Partial<ProfileView>) => {
    setProfile((current) => ({ ...current, ...patch }));
    try {
      await api.patch("/api/profile", patch);
      setError(null);
      // The name shows in the sidebar; refresh so the shell agrees.
      router.refresh();
    } catch {
      setError("That change didn't save.");
    }
  };

  return (
    <div className="flex max-w-[640px] flex-col gap-[18px] p-8">
      <Card>
        <div className="flex items-center gap-3.5">
          <span
            aria-hidden
            className="grid size-12 flex-none place-items-center rounded-full bg-accent font-serif text-[20px] text-on-dark"
          >
            {/* Empty name falls back to a placeholder rather than breaking. */}
            {(profile.name.trim()[0] ?? "?").toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <Field
              label="Name"
              value={profile.name}
              onSave={(value) => save({ name: value })}
              placeholder="Your name"
            />
          </div>
        </div>

        {error && (
          <p className="m-0 mt-3 font-mono text-[11.5px] text-accent-red">{error}</p>
        )}
      </Card>

      <Card>
        <h2 className="m-0 font-serif text-[18px] font-normal">About</h2>

        <Field
          label="Pronouns"
          value={profile.pronouns ?? ""}
          onSave={(value) => save({ pronouns: value || null })}
          placeholder="optional"
        />

        <div className="row-divider list-row">
          <span className="kicker">Birthday</span>
          <div className="mt-1.5 flex items-baseline gap-3">
            <Input
              type="date"
              value={profile.birthday ?? ""}
              onChange={(event) => save({ birthday: event.target.value || null })}
              className="max-w-[180px]"
            />
            <span className="font-mono text-[11.5px] text-muted">
              {/* Derived, never stored — and never a bare zero when unset. */}
              {profile.birthday && age !== null ? `${age} years old` : "Birthday not set"}
            </span>
          </div>
        </div>

        <Field
          label="Location"
          value={profile.location ?? ""}
          onSave={(value) => save({ location: value || null })}
          placeholder="city, country"
        />

        <Field
          label="Email"
          value={profile.contactEmail ?? ""}
          onSave={(value) => save({ contactEmail: value || null })}
          placeholder="contact email"
        />

        <Field
          label="Timezone"
          value={profile.timezone}
          onSave={(value) => save({ timezone: value })}
          placeholder="Asia/Manila"
          hint="every “today” in Ced OS is computed in this zone"
        />

        <div className="row-divider list-row">
          <span className="kicker">Bio</span>
          <Textarea
            rows={4}
            className="mt-1.5"
            defaultValue={profile.bio ?? ""}
            onBlur={(event) => save({ bio: event.target.value || null })}
            placeholder="a short line about you"
          />
        </div>
      </Card>
    </div>
  );
}

function Field({
  label,
  value,
  onSave,
  placeholder,
  hint,
}: {
  label: string;
  value: string;
  onSave: (value: string) => void;
  placeholder?: string;
  hint?: string;
}) {
  const [draft, setDraft] = useState(value);

  return (
    <div className="row-divider list-row">
      <span className="kicker">{label}</span>
      <Input
        className="mt-1.5"
        value={draft}
        placeholder={placeholder}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => draft !== value && onSave(draft)}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
      />
      {hint && <p className="m-0 mt-1.5 font-mono text-[11px] text-muted">{hint}</p>}
    </div>
  );
}
