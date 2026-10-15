import { Brand } from "@/components/auth/auth-shell";
import { Backdrop } from "@/components/auth/backdrop";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative isolate flex min-h-screen flex-col items-center justify-center p-4">
      <Backdrop />
      <Brand />
      {children}
    </main>
  );
}
