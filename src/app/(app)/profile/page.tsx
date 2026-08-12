import { requireSession } from "@/core/auth/session";
import { ageFrom } from "@/core/date";
import { PageHeader } from "@/core/ui/page-header";
import { getProfile } from "@/modules/profile/service";
import { ProfilePage } from "@/modules/profile/ui/profile-page";

export default async function Profile() {
  const session = await requireSession();
  const profile = await getProfile(session.userId);

  return (
    <>
      <PageHeader kicker="Account" title="Profile" />
      <div className="flex-1 overflow-auto">
        <ProfilePage
          initial={profile}
          // Derived at render, never stored (product spec §12.1).
          age={ageFrom(profile.birthday, profile.timezone)}
        />
      </div>
    </>
  );
}
