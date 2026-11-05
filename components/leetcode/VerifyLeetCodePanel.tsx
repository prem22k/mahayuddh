"use client";

import React, { useEffect, useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useLeetCodeSynced } from "@/lib/leetcode/useLeetCodeSynced";
import { syncUserProfileStats } from "@/lib/data/profiles";
import {
  startLeetCodeVerification,
  checkLeetCodeVerification,
} from "@/lib/data/leetcodeVerify";
import { copyText } from "@/lib/clipboard";
import { Button } from "@/components/ui/Button";
import { FormAlert } from "@/components/ui/FormAlert";
import { cn } from "@/lib/utils";

export interface VerifyLeetCodePanelProps {
  handle: string;
  onVerified?: (handle: string) => void;
  collapsed?: boolean;
  className?: string;
}

function formatExpiry(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  } catch {
    return isoString;
  }
}

/**
 * Proves the signed-in person controls a LeetCode handle: get a one-time code,
 * paste it into the LeetCode Summary, check. A different handle (or mode)
 * starts a fresh flow, so the state lives in a keyed inner component.
 */
export function VerifyLeetCodePanel(props: VerifyLeetCodePanelProps) {
  return <VerifyLeetCodePanelFlow key={`${props.handle}|${props.collapsed ? 1 : 0}`} {...props} />;
}

function VerifyLeetCodePanelFlow({
  handle,
  onVerified,
  collapsed = false,
  className,
}: VerifyLeetCodePanelProps) {
  const { user } = useAuth();
  const leetcodeSynced = useLeetCodeSynced();

  const [stepState, setStepState] = useState<"idle" | "pending" | "verified">("idle");
  const [isExpanded, setIsExpanded] = useState(!collapsed);
  const [code, setCode] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [gettingCode, setGettingCode] = useState(false);
  const [checking, setChecking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [alertError, setAlertError] = useState<string | null>(null);
  const [idleMessage, setIdleMessage] = useState<string | null>(null);
  const [cooldownSec, setCooldownSec] = useState(0);
  const [verifiedData, setVerifiedData] = useState<{ handle: string; releasedOther: boolean } | null>(null);

  useEffect(() => {
    if (cooldownSec <= 0) return;
    const t = setInterval(() => {
      setCooldownSec((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(t);
  }, [cooldownSec]);

  const handleVerified = async (vHandle: string, releasedOther: boolean) => {
    setStepState("verified");
    setVerifiedData({ handle: vHandle, releasedOther });
    setAlertError(null);
    setIdleMessage(null);

    if (user?.id) {
      await syncUserProfileStats(user.id, vHandle).catch(() => null);
    }
    await leetcodeSynced().catch(() => null);
    onVerified?.(vHandle);
  };

  const handleGetCode = async () => {
    setGettingCode(true);
    setIdleMessage(null);
    setAlertError(null);

    const res = await startLeetCodeVerification(handle);
    setGettingCode(false);

    if (!res.ok) {
      setIdleMessage(res.error);
      return;
    }

    if (res.status === "verified") {
      await handleVerified(res.handle, res.releasedOther);
      return;
    }

    if (res.status === "pending") {
      setCode(res.code);
      setExpiresAt(res.expiresAt);
      setStepState("pending");
    }
  };

  const handleCopy = async () => {
    if (!code) return;
    const ok = await copyText(code);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleCheck = async () => {
    if (checking || cooldownSec > 0) return;
    setChecking(true);
    setAlertError(null);

    const res = await checkLeetCodeVerification();
    setChecking(false);

    if (res.ok) {
      if (res.status === "verified") {
        await handleVerified(res.handle, res.releasedOther);
        return;
      }
      if (res.status === "not_found_yet") {
        setAlertError(res.message);
        return;
      }
    } else {
      if (res.httpStatus === 410) {
        setStepState("idle");
        setCode("");
        setExpiresAt("");
        setAlertError(null);
        setIdleMessage("That code expired. Get a new one.");
        return;
      }
      if (res.httpStatus === 429) {
        setCooldownSec(res.retryAfter ?? 6);
        setAlertError(res.error);
        return;
      }
      setAlertError(res.error);
    }
  };

  if (stepState === "verified" && verifiedData) {
    return (
      <div
        role="status"
        aria-live="polite"
        className={cn("rounded-lg border border-hairline bg-well p-4", className)}
      >
        <div className="flex items-start gap-2">
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-verified" strokeWidth={1.5} aria-hidden />
          <p className="text-xs leading-5 text-text-primary">
            Verified. @{verifiedData.handle} is yours. You can delete the code from your LeetCode Summary now.
            {verifiedData.releasedOther && " It was linked to another Mahayuddh account, so we removed it there."}
          </p>
        </div>
      </div>
    );
  }

  if (collapsed && !isExpanded && stepState === "idle") {
    return (
      <div className={className}>
        <div aria-live="polite">
          {idleMessage && (
            <div className="mb-2">
              <FormAlert tone="error">{idleMessage}</FormAlert>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => setIsExpanded(true)}
          className="inline-flex min-h-[44px] cursor-pointer items-center text-xs font-medium text-text-secondary underline decoration-hairline-strong underline-offset-2 transition-colors hover:text-text-primary md:min-h-0"
        >
          Verify @{handle} is yours
        </button>
      </div>
    );
  }

  if (stepState === "idle") {
    return (
      <div className={cn("space-y-3 rounded-lg border border-hairline bg-well p-4", className)}>
        <div aria-live="polite">
          {idleMessage && <FormAlert tone="error">{idleMessage}</FormAlert>}
        </div>
        <div className="space-y-1">
          <h3 className="text-xs font-semibold text-text-primary">
            Prove @{handle} is yours
          </h3>
          <p className="text-xs leading-5 text-text-secondary">
            Squadmates see a verified mark, and your LeetCode solves count as verified instead of self-reported.
          </p>
        </div>
        <div>
          <Button
            type="button"
            variant="secondary"
            loading={gettingCode}
            disabled={gettingCode}
            onClick={() => void handleGetCode()}
            className="h-11 text-xs md:h-9"
          >
            Get a code
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-3 rounded-lg border border-hairline bg-well p-4", className)}>
      <div aria-live="polite">
        {alertError && <FormAlert tone="error">{alertError}</FormAlert>}
      </div>

      <ol className="space-y-3 text-xs leading-5">
        <li className="space-y-1.5">
          <span className="text-text-secondary">1. Copy this code</span>
          <div className="flex items-center gap-2">
            <code className="rounded-md border border-hairline bg-surface px-2.5 py-1 font-mono text-sm font-semibold tracking-wider text-text-primary">
              {code}
            </code>
            <button
              type="button"
              onClick={() => void handleCopy()}
              className="inline-flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-md border border-hairline px-3 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary md:h-8 md:min-h-0"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
        </li>

        <li className="space-y-1.5">
          <span className="text-text-secondary">
            2. Paste it anywhere in your Summary on LeetCode, then click Save there.
          </span>
          <div>
            <a
              href="https://leetcode.com/profile/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[44px] cursor-pointer items-center gap-1 text-xs font-medium text-text-primary underline decoration-hairline-strong underline-offset-2 hover:decoration-text-primary md:min-h-0"
            >
              <span>Open LeetCode settings</span>
              <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
            </a>
          </div>
        </li>

        <li className="space-y-1.5">
          <span className="text-text-secondary">3. Come back and check.</span>
          <div>
            <Button
              type="button"
              variant="primary"
              loading={checking}
              disabled={checking || cooldownSec > 0}
              onClick={() => void handleCheck()}
              className="h-11 text-xs md:h-9"
            >
              {cooldownSec > 0 ? `Check again in ${cooldownSec}s` : "Check now"}
            </Button>
          </div>
        </li>
      </ol>

      <p className="border-t border-hairline pt-2.5 text-[11px] leading-4 text-text-tertiary">
        Code works until {formatExpiry(expiresAt)}. You can delete it from your Summary once you&apos;re verified.
      </p>
    </div>
  );
}
