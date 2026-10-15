"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";

export function TagInput({ value, onChange, placeholder, max = 10, suggestions = [], id }: {
  value: string[]; onChange: (v: string[]) => void; placeholder: string; max?: number; suggestions?: string[]; id?: string;
}) {
  const [text, setText] = useState("");
  const add = (raw: string) => {
    const t = raw.trim();
    if (!t || value.length >= max || value.some((v) => v.toLowerCase() === t.toLowerCase())) return setText("");
    onChange([...value, t]);
    setText("");
  };
  return (
    <div>
      <div className="flex min-h-11 flex-wrap items-center gap-2 rounded-lg border border-[#2A3350] bg-[#0B0F19] px-3 py-1.5 focus-within:border-[#818CF8] focus-within:ring-[3px] focus-within:ring-[#818CF8]/20">
        {value.map((t) => (
          <span key={t} className="flex h-7 items-center gap-1 rounded-md border border-[#818CF8]/35 bg-[#818CF8]/10 pl-2.5 pr-1.5 text-[13px] text-[#C7D2FE]">
            {t}
            <button type="button" aria-label={`Remove ${t}`} onClick={() => onChange(value.filter((v) => v !== t))}><X size={14} /></button>
          </span>
        ))}
        <input
          id={id} value={text} placeholder={value.length ? "" : placeholder}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(text); }
            if (e.key === "Backspace" && !text && value.length) onChange(value.slice(0, -1));
          }}
          onBlur={() => add(text)}
          className="h-7 min-w-[120px] flex-1 bg-transparent text-sm text-[#F1F5F9] outline-none placeholder:text-[#7C8AA5]"
        />
      </div>
      {suggestions.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {suggestions.filter((s) => !value.includes(s)).map((s) => (
            <button key={s} type="button" onClick={() => add(s)} className="flex h-8 items-center gap-2 rounded-lg border border-[#2A3350] bg-[#111623] px-3 text-[13px] font-medium text-[#E2E8F0] hover:border-[#3A4666]">
              <Plus size={14} className="text-[#818CF8]" />{s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
