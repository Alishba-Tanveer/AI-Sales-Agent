"use client";

import { CheckCircle2, Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { inputCls } from "@/components/auth/auth-shell";
import { PASSWORD_RULES, passwordStrength } from "@/features/auth/schemas";

const BAR = ["#F87171", "#FBBF24", "#38BDF8", "#4ADE80"];
const LABEL = ["Too weak", "Weak", "Okay", "Good", "Strong"];

/** Password input with a show/hide toggle. Shared by Sign up and Reset password. */
export function PasswordInput({ id, show, onToggle, ...rest }: React.ComponentProps<typeof Input> & { show: boolean; onToggle: () => void }) {
  return (
    <div className="relative">
      <Input id={id} type={show ? "text" : "password"} placeholder="••••••••••••" className={`${inputCls} pr-10`} {...rest} />
      <button type="button" aria-label="Toggle password visibility" onClick={onToggle} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#E5E7EB]">
        {show ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}

/** Strength bar + live checklist for the password policy (see passwordSchema). */
export function PasswordStrength({ value }: { value: string }) {
  const strength = passwordStrength(value);
  return (
    <>
      <div className="grid h-1 grid-cols-4 gap-1.5 pt-1">
        {BAR.map((c, i) => <div key={c} className="h-1 rounded-full bg-[#232A3B] transition-colors" style={i < strength ? { background: c } : undefined} />)}
      </div>
      <p className="flex items-center gap-1 pt-1 text-[11px] text-[#94A3B8]">
        {strength === 4 && <CheckCircle2 size={14} className="text-[#4ADE80]" />}
        {LABEL[strength]}
      </p>
      <ul className="grid grid-cols-2 gap-x-3 gap-y-1 pt-1">
        {PASSWORD_RULES.map((r) => {
          const ok = r.test(value);
          return (
            <li key={r.id} className={`flex items-center gap-1.5 text-[11px] ${ok ? "text-[#4ADE80]" : "text-[#94A3B8]"}`}>
              <CheckCircle2 size={13} className={ok ? "" : "opacity-40"} />
              {r.label}
            </li>
          );
        })}
      </ul>
    </>
  );
}
