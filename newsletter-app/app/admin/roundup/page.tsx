import { AdminShell } from "@/components/admin-shell";
import { RoundupEditor } from "@/components/roundup-editor";
import { requireAdminPage } from "@/lib/auth";
import { loadHomepageRoundup } from "@/lib/homepage-roundup";

export const dynamic = "force-dynamic";

export default async function WeeklyRoundupPage() {
  await requireAdminPage();
  const roundup = await loadHomepageRoundup();

  return (
    <AdminShell>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Homepage</p>
          <h1>Weekly Roundup</h1>
          <p>Edit the three &ldquo;This Week at Ch&eacute;vere&rdquo; cards shown on the homepage.</p>
        </div>
      </div>
      <RoundupEditor initialRoundup={roundup} />
    </AdminShell>
  );
}
