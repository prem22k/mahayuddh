"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Copy, Check, NotebookPen, Trash2 } from "lucide-react";
import { PageLoader } from "@/components/ui/PageLoader";
import { copyText } from "@/lib/clipboard";
import { getApproachById, deleteApproach, setApproachVisibility } from "@/lib/data/approaches";
import { copyApproachToNotebook } from "@/lib/data/notebook";
import { dataErrorMessage } from "@/lib/data/errors";
import { track } from "@/lib/analytics";
import { useAuth } from "@/components/providers/AuthProvider";
import { ApproachVisibility } from "@/types/database";

/**
 * Approach detail page (plan Step 9: "Approach view page with Copy-to-Notebook").
 *
 * Before this, code / key_detail / edge_cases / mistakes were stored but never
 * rendered anywhere. Sharing an approach meant sharing a truncated paragraph.
 * Spoiler discipline (Bible §12): the code block is blurred until the reader
 * opts in, so learning is not short-circuited by a peek.
 */
export default function ApproachPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { user, profile } = useAuth();
  const [approach, setApproach] = useState<Awaited<ReturnType<typeof getApproachById>>>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [revealCode, setRevealCode] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setApproach(await getApproachById(id));
    } catch (err) {
      setLoadError(dataErrorMessage(err, "Couldn't load this approach. Retry."));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <PageLoader label="Loading approach..." />;
  if (loadError) {
    return (
      <div role="alert" className="p-12 text-center space-y-3">
        <p className="text-xs text-[#ff453a]">{loadError}</p>
        <button
          onClick={load}
          className="px-4 py-2 rounded-full btn-accent text-white text-xs font-bold cursor-pointer"
        >
          Retry
        </button>
      </div>
    );
  }
  if (!approach) {
    return (
      <div className="p-12 text-center space-y-3">
        <p className="text-sm font-bold text-white">Approach not found.</p>
        <p className="text-xs text-white/55">
          It may be private to its author, or deleted.
        </p>
        <Link href="/practice" className="inline-block px-4 py-2 rounded-full bg-white/[0.06] border border-white/[0.1] text-white text-xs font-bold">
          Back to practice
        </Link>
      </div>
    );
  }

  const author = approach.author ?? approach.author_profile;
  const isOwner = approach.user_id === user?.id;
  const asText = [
    approach.core_idea,
    approach.complexity_time ? `Time: ${approach.complexity_time}` : "",
    approach.complexity_space ? `Space: ${approach.complexity_space}` : "",
    approach.key_detail ? `Key detail: ${approach.key_detail}` : "",
    approach.edge_cases ? `Edge cases: ${approach.edge_cases}` : "",
    approach.mistakes ? `Mistakes: ${approach.mistakes}` : "",
    approach.code ? `\n\`\`\`\n${approach.code}\n\`\`\`` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const Row = ({ label, value }: { label: string; value: string | null }) =>
    value ? (
      <div className="grid grid-cols-[90px_1fr] gap-3 py-2 border-t border-white/[0.04]">
        <span className="text-[11px] font-semibold text-white/55 uppercase tracking-wider">
          {label}
        </span>
        <span className="text-xs text-white/70 whitespace-pre-wrap leading-relaxed">
          {value}
        </span>
      </div>
    ) : null;

  return (
    <div className="space-y-6 select-none max-w-3xl">
      <Link
        href={`/practice/${approach.problem_slug}`}
        className="flex items-center gap-1.5 text-xs text-white/55 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>{approach.problem_slug}</span>
      </Link>

      <header className="space-y-2">
        <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
          Approach
        </h1>
        <div className="flex items-center gap-2 text-xs text-white/50 flex-wrap">
          <span className="font-semibold text-white/80">@{author?.username || "unknown"}</span>
          <span className="uppercase text-[10px]">{approach.visibility}</span>
          {approach.pattern && (
            <span className="px-2 py-0.5 rounded-full bg-white/[0.06] border border-white/[0.08] text-[10px]">
              {approach.pattern}
            </span>
          )}
          <span className="text-white/25 font-mono">
            {new Date(approach.created_at).toLocaleDateString()}
          </span>
        </div>
      </header>

      <section className="rounded-3xl bg-white/[0.02] border border-white/[0.06] p-5">
        <div className="text-xs font-bold text-white mb-2">Core idea</div>
        <p className="text-sm text-white/80 leading-relaxed whitespace-pre-wrap">
          {approach.core_idea}
        </p>

        <div className="mt-3">
          <Row label="Time" value={approach.complexity_time} />
          <Row label="Space" value={approach.complexity_space} />
          <Row label="Key detail" value={approach.key_detail} />
          <Row label="Edge cases" value={approach.edge_cases} />
          <Row label="Mistakes" value={approach.mistakes} />
        </div>

        {approach.code && (
          <div className="mt-4 border-t border-white/[0.06] pt-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-white/55 uppercase tracking-wider">
                Code
              </span>
              {!revealCode && (
                <button
                  onClick={() => setRevealCode(true)}
                  className="text-[11px] font-bold text-[#fa586a] hover:underline cursor-pointer"
                >
                  Reveal solution
                </button>
              )}
            </div>
            <pre
              className={`p-4 rounded-2xl bg-black/40 text-[11px] text-white/70 overflow-x-auto transition-all ${
                revealCode ? "blur-0" : "blur-md select-none"
              }`}
            >
              <code>{approach.code}</code>
            </pre>
            {!revealCode && (
              <p className="text-[10px] text-white/25 mt-1">
                Hidden so you solve it first. Read it after your own attempt.
              </p>
            )}
          </div>
        )}
      </section>

      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={async () => {
            if (await copyText(asText)) {
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }
          }}
          className="px-4 py-2 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.08] text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-[#30d158]" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>

        {user && (
          <button
            onClick={async () => {
              try {
                await copyApproachToNotebook(approach.id);
                track("note_copied", { fork_of: approach.id });
                setSaved(true);
                setTimeout(() => setSaved(false), 2000);
              } catch {
                // logged out or RLS: the plain Copy button still works
              }
            }}
            className="px-4 py-2 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.08] text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
          >
            <NotebookPen className="w-3.5 h-3.5" />
            {saved ? "Saved to notebook" : "Copy to my notebook"}
          </button>
        )}

        {isOwner && (
          <>
            <select
              value={approach.visibility}
              onChange={async (e) => {
                const v = e.target.value as ApproachVisibility;
                if (v === "squad" && !profile?.active_squad_id) return;
                await setApproachVisibility(approach.id, v, profile?.active_squad_id ?? null);
                load();
              }}
              className="bg-white/[0.04] border border-white/[0.08] rounded-full px-3 py-2 text-[11px] text-white cursor-pointer"
              title="Sharing is intentional and reversible"
            >
              <option value="private">Private</option>
              <option value="squad">Squad</option>
              <option value="public">Public</option>
            </select>
            <button
              onClick={async () => {
                if (!window.confirm("Delete this approach?")) return;
                await deleteApproach(approach.id);
                load();
              }}
              className="p-2 rounded-full text-white/50 hover:text-[#ff453a] cursor-pointer"
              title="Delete approach"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}