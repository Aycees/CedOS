import { requireSession } from "@/core/auth/session";
import { PageHeader } from "@/core/ui/page-header";
import { getSettings } from "@/modules/settings/service";
import { SettingsPage } from "@/modules/settings/ui/settings-page";

export default async function Settings() {
  const session = await requireSession();
  const settings = await getSettings(session.userId);

  return (
    <>
      <PageHeader kicker="Preferences" title="Settings" />
      <div className="flex-1 overflow-auto">
        <SettingsPage
          name={session.name}
          email={session.email}
          weekStartsOn={settings.weekStartsOn}
        />
      </div>
    </>
  );
}
