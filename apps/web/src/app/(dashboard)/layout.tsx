import { AuthGuard } from "@/components/auth/auth-guard";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { ProfileSync } from "@/components/dashboard/profile-sync";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <ProfileSync>
        <DashboardShell>{children}</DashboardShell>
      </ProfileSync>
    </AuthGuard>
  );
}
