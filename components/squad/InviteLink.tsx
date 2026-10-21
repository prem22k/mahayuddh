"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Check, Link2 } from "lucide-react";
import { copyText } from "@/lib/clipboard";
import { track } from "@/lib/analytics";
import { ShareRow } from "@/components/ui/ShareRow";
import { getOrCreateMyReferralLink, getMyReferralLinks, type ReferralLink } from "@/lib/data/referrals";
import { dataErrorMessage } from "@/lib/data/errors";

/**
 * Loop D — your invite link (§56, §40, §57).
 *
 * A squad's `invite_code` is one shared capability. Copying just that into a
 * chat works, but it answers "who sent this?" with nobody — so whoever sent it
 * cannot tell whether their invite did anything, which is the whole reason to
 * invite people.
 *
 * So the link carries a referral token as well. It grants nothing: the code
 * beside it is what authorises the join. The token only records who to thank,
 * which is also why "opens" is shown next to "joins" — a member whose link got
 * twelve opens and no joins has been told to look at their pitch, not at their
 * link.
 */
export function InviteLink({ squadId, squadName }: { squadId: string; squadName: string }) {
  const [link, setLink] = useState<ReferralLink | null>(null);
  const [all, setAll] = useState<ReferralLink[]>([]);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      // Mint on first view so the link is always ready to copy, then read the
      // full list so a member with several squads sees all of them.
      const mine = await getOrCreateMyReferralLink(squadId);
      setLink(mine);
      setAll(await getMyReferralLinks());
    } catch (err) {
      setError(dataErrorMessage(err, "Couldn't get an invite link."));
    }
  }, [squadId]);

  useEffect(() => {
    void load();
  }, [load]);

  const copy = async () => {
    if (!link) return;
    const url = `${window.location.origin}${link.path}`;
    if (await copyText(url)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      // Loop D's outbound signal. Opens and joins are counted server-side; this
      // is the one event the member is responsible for.
      track("invite_link_copied", { squad_id: squadId });
    }
  };

  if (error) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-md border border-hairline bg-well px-3 py-2">
        <p className="text-[11px] leading-4 text-text-secondary">{error}</p>
        <button
          onClick={() => void load()}
          className="inline-flex h-8 min-h-[44px] shrink-0 items-center rounded-sm px-3 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary md:min-h-0"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!link) {
    return (
      <button
        onClick={async () => {
          setBusy(true);
          await load();
          setBusy(false);
        }}
        disabled={busy}
        className="flex h-9 min-h-[44px] w-full items-center justify-center gap-2 rounded-md border border-hairline bg-surface-overlay text-xs font-medium text-text-primary transition-colors hover:bg-[#272830] disabled:text-text-disabled md:min-h-0"
      >
        <Link2 className="h-3.5 w-3.5 text-text-secondary" strokeWidth={1.5} />
        {busy ? "Getting your link…" : "Get my invite link"}
      </button>
    );
  }

  const totals = all.reduce(
    (acc, l) => ({ opens: acc.opens + l.opens, joins: acc.joins + l.joins }),
    { opens: 0, joins: 0 }
  );

  return (
    <div className="space-y-2.5">
      <div className="flex items-stretch gap-2">
        <button
          onClick={() => void copy()}
          className="flex h-9 min-h-[44px] flex-1 items-center justify-center gap-2 rounded-md border border-hairline bg-surface-overlay text-xs font-medium text-text-primary transition-colors hover:bg-[#272830] md:min-h-0"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-verified" strokeWidth={1.5} />
          ) : (
            <Link2 className="h-3.5 w-3.5 text-text-secondary" strokeWidth={1.5} />
          )}
          {copied ? "Copied" : "Copy invite link"}
        </button>
        {/* §40: the same distribution targets as every other artifact, because
            a squad invite is shared into the same WhatsApp/Discord groups. */}
        <ShareRow
          compact
          className="h-9"
          path={link.path}
          artifact={{ kind: "squad", id: squadId }}
          text={`Join my squad "${squadName}" on Mahayuddh — we battle the same problems and compare approaches.`}
          label="Share"
        />
      </div>

      {/* Opens next to joins, because the gap between them is the useful part. */}
      <div className="flex items-center justify-between gap-3 border-t border-hairline pt-2 font-mono text-[11px] text-text-tertiary">
        <span className="truncate">Link activity</span>
        <span className="shrink-0 whitespace-nowrap text-text-secondary tnum">
          {totals.opens} opened · {totals.joins} joined
        </span>
      </div>
      {totals.joins === 0 && totals.opens > 0 && (
        <p className="text-[11px] leading-4 text-text-tertiary">
          {totals.opens === 1 ? "Someone opened" : "People opened"} your link but nobody joined yet. The link is
          fine — try naming the squad.
        </p>
      )}

      {all.length > 1 && (
        <ul className="space-y-0.5 font-mono text-[10px] text-text-tertiary tnum">
          {all.map((l) => (
            <li key={l.squad_id} className="flex items-center justify-between gap-3">
              <span className="truncate font-sans">{l.squad_name}</span>
              <span className="shrink-0">
                {l.opens} opened · {l.joins} joined
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
