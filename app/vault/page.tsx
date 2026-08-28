"use client";

import React, { useState, useEffect } from "react";
import {
  Copy,
  Check,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getSharedResources, createSharedResource } from "@/lib/data/vault";
import { SharedResource, ResourceCategory } from "@/types/database";

export default function VaultPage() {
  const [activeTab, setActiveTab] = useState<ResourceCategory>("Template");
  const [resources, setResources] = useState<SharedResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<ResourceCategory>("Template");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function loadResources() {
      setLoading(true);
      try {
        const data = await getSharedResources(activeTab);
        setResources(data);
      } catch (err) {
        console.error("Error loading resources:", err);
      } finally {
        setLoading(false);
      }
    }
    loadResources();
  }, [activeTab]);

  const handleCopy = (id: string, code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !content) return;

    setSubmitting(true);
    try {
      const created = await createSharedResource({
        title,
        category,
        content,
      });

      if (created) {
        setResources([created, ...resources]);
        setIsModalOpen(false);
        setTitle("");
        setContent("");
      }
    } catch (err) {
      console.error("Error creating resource:", err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 select-none">
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="text-[11px] font-semibold text-[#fa586a] tracking-[0.2em] uppercase mb-1">
            Squad Knowledge
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">
            Knowledge Vault
          </h1>
          <p className="text-xs text-white/40 mt-1">
            Reusable algorithm templates and real-world company interview debriefs.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start md:self-auto">
          {/* Add Resource Button */}
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-3.5 py-1.5 rounded-full bg-[#fa586a] hover:bg-[#fa586a]/90 text-white font-semibold text-xs flex items-center gap-1.5 shadow-glow cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add to Vault</span>
          </button>

          {/* Tab Pills (Clean Apple Music Text Pills) */}
          <div className="flex items-center p-1 bg-white/[0.04] rounded-full border border-white/[0.06]">
            <button
              onClick={() => setActiveTab("Template")}
              className={cn(
                "px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer",
                activeTab === "Template"
                  ? "bg-white/[0.12] text-white shadow-sm"
                  : "text-white/40 hover:text-white/80"
              )}
            >
              Templates
            </button>
            <button
              onClick={() => setActiveTab("Interview Log")}
              className={cn(
                "px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer",
                activeTab === "Interview Log"
                  ? "bg-white/[0.12] text-white shadow-sm"
                  : "text-white/40 hover:text-white/80"
              )}
            >
              Interview Logs
            </button>
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      {loading ? (
        <div className="h-60 flex flex-col items-center justify-center gap-3 text-white/40">
          <div className="w-7 h-7 animate-spin rounded-full border-2 border-white/10 border-t-[#fa586a]" />
          <span className="text-xs">Loading vault items...</span>
        </div>
      ) : resources.length === 0 ? (
        <div className="p-12 text-center text-white/40 text-xs bg-[#1c1c1e]/60 rounded-2xl border border-white/[0.06]">
          No resources found in this category. Click &ldquo;Add to Vault&rdquo; to contribute.
        </div>
      ) : (
        <div className="space-y-6">
          {resources.map((item) => (
            <div
              key={item.id}
              className="bg-[#1c1c1e]/60 border border-white/[0.06] rounded-2xl overflow-hidden shadow-subtle backdrop-blur-xl"
            >
              <div className="p-5 border-b border-white/[0.06] flex items-center justify-between bg-white/[0.02]">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-white/[0.06] text-white/70 border border-white/[0.08] text-[10px] font-bold uppercase tracking-wider">
                      {item.category}
                    </span>
                    <h3 className="text-sm font-bold text-white">{item.title}</h3>
                  </div>
                  <span className="text-[11px] text-white/30 mt-1 block">
                    Added on {new Date(item.created_at).toLocaleDateString()}
                  </span>
                </div>

                <button
                  onClick={() => handleCopy(item.id, item.content)}
                  className="px-2.5 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-white/50 hover:text-white transition-all flex items-center gap-1.5 text-xs cursor-pointer"
                  title="Copy content"
                >
                  {copiedId === item.id ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-[#30d158]" />
                      <span className="text-[#30d158] text-[11px] font-medium">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span className="text-[11px] font-medium">Copy</span>
                    </>
                  )}
                </button>
              </div>

              <div className="p-5 bg-black/40 overflow-x-auto font-mono text-xs text-white/80 leading-relaxed whitespace-pre-wrap">
                {item.content}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Add Modal ── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md" onClick={() => setIsModalOpen(false)} />
          <div className="relative w-full max-w-lg bg-[#1c1c1e] border border-white/[0.1] rounded-3xl shadow-modal p-6 z-10 animate-in fade-in zoom-in-95">
            <h2 className="text-xl font-bold text-white mb-1">Add to Knowledge Vault</h2>
            <p className="text-xs text-white/40 mb-5">Share an algorithm template or interview debrief.</p>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-white/50 uppercase tracking-wider mb-1.5 pl-1">Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Monotonic Queue Pattern or Meta Phone Screen Log"
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl p-2.5 text-xs text-white placeholder:text-white/25 focus:outline-none focus:border-[#fa586a]/60"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-white/50 uppercase tracking-wider mb-1.5 pl-1">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as ResourceCategory)}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-[#fa586a]/60"
                >
                  <option value="Template" className="bg-[#1c1c1e] text-white">Code Template</option>
                  <option value="Interview Log" className="bg-[#1c1c1e] text-white">Interview Log</option>
                  <option value="Cheat Sheet" className="bg-[#1c1c1e] text-white">Cheat Sheet</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-white/50 uppercase tracking-wider mb-1.5 pl-1">Content (Markdown / Code)</label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Write your template explanation, complexity, and code snippet..."
                  rows={6}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl p-2.5 text-xs text-white placeholder:text-white/25 focus:outline-none focus:border-[#fa586a]/60 font-mono resize-none"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-full bg-white/[0.04] text-white/50 hover:text-white text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-full bg-[#fa586a] hover:bg-[#fa586a]/90 text-white text-xs font-semibold shadow-glow transition-all disabled:opacity-50"
                >
                  {submitting ? "Saving..." : "Save to Vault"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
