"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Copy, Check } from "lucide-react";
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
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] text-text-secondary">{error}</p>
        <button
          onClick={() => void load()}
          className="px-3 py-1 rounded-full bg-surface-overlay text-[11px] font-bold text-text-secondary hover:text-text-primary cursor-pointer shrink-0"
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
        className="px-4 py-2 rounded-full bg-surface-overlay hover:bg-surface-raised border border-hairline text-text-secondary text-[11px] font-bold transition-all cursor-pointer disabled:opacity-50"
      >
        {busy ? "Getting your link…" : "Get my invite link"}
      </button>
    );
  }

  const totals = all.reduce(
    (acc, l) => ({ opens: acc.opens + l.opens, joins: acc.joins + l.joins }),
    { opens: 0, joins: 0 }
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => void copy()}
          className="px-3 py-2 rounded-full bg-surface-overlay hover:bg-surface-raised border border-hairline text-text-secondary text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1.5"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-verified" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? "Copied" : "Copy link"}
        </button>
        {/* §40: the same distribution targets as every other artifact, because
            a squad invite is shared into the same WhatsApp/Discord groups. */}
        <ShareRow
          path={link.path}
          artifact={{ kind: "squad", id: squadId }}
          text={`Join my squad "${squadName}" on Mahayuddh — we battle the same problems and compare approaches.`}
          label="Share invite"
        />
      </div>

      {/* Opens next to joins, because the gap between them is the useful part. */}
      <p className="text-[11px] text-text-secondary">
        {totals.joins > 0
          ? `${totals.joins} ${totals.joins === 1 ? "person has" : "people have"} joined through your links (${totals.opens} ${totals.opens === 1 ? "open" : "opens"}).`
          : totals.opens > 0
            ? `${totals.opens} ${totals.opens === 1 ? "person has" : "people have"} opened your link but not joined. The link is fine — try naming the squad.`
            : "Nobody has opened your link yet."}
      </p>

      {all.length > 1 && (
        <ul className="text-[10px] text-text-disabled space-y-0.5">
          {all.map((l) => (
            <li key={l.squad_id}>
              {l.squad_name}: {l.joins} joined · {l.opens} opened
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
