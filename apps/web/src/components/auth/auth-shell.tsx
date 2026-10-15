import { Bot } from "lucide-react";

export function Brand() {
  return (
    <div className="mb-8 flex items-center gap-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#818CF8] text-[#0B0F19]">
        <Bot size={20} />
      </div>
      <span className="text-base font-semibold text-white">AI Sales Agent</span>
    </div>
  );
}

export function AuthCard({ title, subtitle, children, footer }: {
  title: string; subtitle: string; children: React.ReactNode; footer?: React.ReactNode;
}) {
  return (
    <div className="w-full max-w-[460px] rounded-xl border border-[#232A3B] bg-[#111623] p-6 shadow-2xl sm:p-8">
      <div className="absolute inset-x-0 top-0 h-0.5 rounded-t-xl bg-gradient-to-r from-[#818CF8] to-[#C084FC]" />
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-[#E5E7EB]">{title}</h1>
        <p className="mt-1 text-sm text-[#94A3B8]">{subtitle}</p>
      </div>
      {children}
      {footer && <div className="mt-6 flex justify-center border-t border-[#232A3B] pt-5 text-xs text-[#94A3B8]">{footer}</div>}
    </div>
  );
}

export const inputCls =
  "h-10 w-full rounded-lg border border-[#232A3B] bg-[#1A2030] px-3 text-sm text-[#E5E7EB] placeholder:text-[#94A3B8]/60 focus-visible:border-[#818CF8] focus-visible:ring-1 focus-visible:ring-[#818CF8] focus-visible:ring-offset-0";
export const primaryBtn =
  "h-10 w-full gap-2 rounded-lg bg-[#818CF8] text-sm font-semibold text-[#0B0F19] hover:bg-[#6366F1] disabled:opacity-70";

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p role="alert" className="mt-1 text-xs text-[#F87171]">{message}</p>;
}

export function ServerError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <div role="alert" className="rounded-lg border border-[#5B1F1F] bg-[#2A1212] p-3 text-xs text-[#F87171]">
      {message}
    </div>
  );
}
