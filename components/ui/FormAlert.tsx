import React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface FormAlertProps {
  tone: "error" | "success";
  children: React.ReactNode;
}

/** Single-line form feedback banner (modal + page forms). */
export function FormAlert({ tone, children }: FormAlertProps) {
  const isError = tone === "error";
  return (
    <div
      role={isError ? "alert" : "status"}
      className={cn(
        "text-xs font-medium p-3 rounded-xl border flex items-center gap-1.5",
        isError
          ? "text-[#ff453a] bg-[#ff453a]/10 border-[#ff453a]/20"
          : "text-[#30d158] bg-[#30d158]/10 border-[#30d158]/20"
      )}
    >
      {!isError && <Check className="w-3.5 h-3.5 shrink-0" />}
      <span>{children}</span>
    </div>
  );
}
