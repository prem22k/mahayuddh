"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Copy,
  Check,
  Plus,
  User,
  Search,
  Trash2,
  ExternalLink,
  BookOpen,
  Sparkles,
  Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getSharedResources, createSharedResource, deleteSharedResource } from "@/lib/data/vault";
import { SharedResource, ResourceCategory } from "@/types/database";
import { useAuth } from "@/components/providers/AuthProvider";

type TabFilter = "All" | ResourceCategory;

const CATEGORY_STYLES: Record<ResourceCategory, { label: string; badge: string }> = {
  Template: {
    label: "Code Template",
    badge: "bg-[#0a84ff]/15 text-[#0a84ff] border-[#0a84ff]/25",
  },
  "Interview Log": {
    label: "Interview Log",
    badge: "bg-[#fa586a]/15 text-[#fa586a] border-[#fa586a]/25",
  },
  "Cheat Sheet": {
    label: "Cheat Sheet",
    badge: "bg-[#ffd60a]/15 text-[#ffd60a] border-[#ffd60a]/25",
  },
  Article: {
    label: "Article / Guide",
    badge: "bg-[#bf5af2]/15 text-[#bf5af2] border-[#bf5af2]/25",
  },
};

export default function VaultPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabFilter>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [resources, setResources] = useState<SharedResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<ResourceCategory>("Template");
  const [content, setContent] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function loadResources() {
      setLoading(true);
      try {
        const data = await getSharedResources();
        setResources(data);
      } catch (err) {
        console.error("Error loading resources:", err);
      } finally {
        setLoading(false);
      }
    }
    loadResources();
  }, []);

  const counts = useMemo(() => {
    const map: Record<string, number> = {
      All: resources.length,
      Template: 0,
      "Interview Log": 0,
      "Cheat Sheet": 0,
      Article: 0,
    };
    resources.forEach((r) => {
      if (map[r.category] !== undefined) {
        map[r.category]++;
      }
    });
    return map;
  }, [resources]);

  const filteredResources = useMemo(() => {
    return resources.filter((item) => {
      const matchesTab = activeTab === "All" || item.category === activeTab;
      if (!matchesTab) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const titleMatch = item.title.toLowerCase().includes(q);
      const contentMatch = item.content.toLowerCase().includes(q);
      const authorMatch = item.author_profile?.username?.toLowerCase().includes(q);
      return titleMatch || contentMatch || authorMatch;
    });
  }, [resources, activeTab, searchQuery]);

  const handleCopy = (id: string, code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDelete = async (id: string) => {
    if (!user) return;
    if (!window.confirm("Are you sure you want to delete this resource from the vault?")) return;

    setDeletingId(id);
    try {
      const ok = await deleteSharedResource(id, user.id);
      if (ok) {
        setResources((prev) => prev.filter((r) => r.id !== id));
      }
    } catch (err) {
      console.error("Error deleting resource:", err);
    } finally {
      setDeletingId(null);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim() || !user) return;

    setSubmitting(true);
    try {
      const created = await createSharedResource({
        title: title.trim(),
        category,
        content: content.trim(),
        authorId: user.id,
        externalUrl: externalUrl.trim() || undefined,
      });

      if (created) {
        setResources((prev) => [created, ...prev]);
        setIsModalOpen(false);
        setTitle("");
        setContent("");
        setExternalUrl("");
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
          <div className="text-[11px] font-semibold text-[#fa586a] tracking-[0.2em] uppercase mb-1 flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5" />
            <span>Squad Knowledge</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">
            Knowledge Vault
          </h1>
          <p className="text-xs text-white/40 mt-1">
            Dynamic algorithm templates, company interview logs, and algorithmic cheat sheets.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start md:self-auto flex-wrap">
          {/* Add Resource Button */}
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 rounded-full bg-[#fa586a] hover:bg-[#fa586a]/90 text-white font-semibold text-xs flex items-center gap-1.5 shadow-glow cursor-pointer transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add to Vault</span>
          </button>
        </div>
      </div>

      {/* ── Search & Filter Bar ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        {/* Tab Filter Pills */}
        <div className="flex items-center p-1 bg-white/[0.04] rounded-2xl border border-white/[0.06] flex-wrap gap-1">
          {(["All", "Template", "Interview Log", "Cheat Sheet", "Article"] as TabFilter[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5",
                activeTab === tab
                  ? "bg-white/[0.12] text-white shadow-sm"
                  : "text-white/40 hover:text-white/80"
              )}
            >
              <span>{tab === "All" ? "All Resources" : tab === "Template" ? "Code Templates" : tab}</span>
              <span
                className={cn(
                  "px-1.5 py-0.2 rounded-full text-[10px] font-mono",
                  activeTab === tab ? "bg-white/20 text-white font-bold" : "bg-white/[0.06] text-white/40"
                )}
              >
                {counts[tab] ?? 0}
              </span>
            </button>
          ))}
        </div>

        {/* Live Search Input */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-white/30 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search templates, logs, keywords..."
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-[#fa586a]/60 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white text-xs"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* ── Content List ── */}
      {loading ? (
        <div className="h-60 flex flex-col items-center justify-center gap-3 text-white/40">
          <div className="w-7 h-7 animate-spin rounded-full border-2 border-white/10 border-t-[#fa586a]" />
          <span className="text-xs">Loading vault items...</span>
        </div>
      ) : filteredResources.length === 0 ? (
        <div className="p-12 text-center text-white/40 text-xs bg-[#1c1c1e]/60 rounded-2xl border border-white/[0.06]">
          {searchQuery
            ? `No vault entries matching "${searchQuery}".`
            : "No resources found in this category. Click “Add to Vault” to contribute."}
        </div>
      ) : (
        <div className="space-y-6">
          {filteredResources.map((item) => {
            const author = item.author_profile;
            const isOwner = user && item.author_id === user.id;
            const categoryStyle = CATEGORY_STYLES[item.category] || CATEGORY_STYLES.Template;

            return (
              <div
                key={item.id}
                className="bg-[#1c1c1e]/60 border border-white/[0.06] rounded-2xl overflow-hidden shadow-subtle backdrop-blur-xl transition-all hover:border-white/[0.1] group"
              >
                <div className="p-5 border-b border-white/[0.06] flex items-center justify-between bg-white/[0.02] flex-wrap gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={cn(
                          "px-2.5 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider",
                          categoryStyle.badge
                        )}
                      >
                        {categoryStyle.label}
                      </span>
                      <h3 className="text-sm md:text-base font-bold text-white tracking-tight">
                        {item.title}
                      </h3>
                      {item.external_url && (
                        <a
                          href={item.external_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#0a84ff] hover:underline text-xs flex items-center gap-1"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>Resource Link</span>
                        </a>
                      )}
                    </div>

                    <div className="flex items-center gap-2 mt-2 text-[11px] text-white/40 flex-wrap">
                      {author ? (
                        <div className="flex items-center gap-1.5">
                          <div className="w-4 h-4 rounded-full bg-[#fa586a]/20 flex items-center justify-center text-[9px] font-bold text-white overflow-hidden shrink-0">
                            {author.avatar_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={author.avatar_url}
                                alt={author.username}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <User className="w-2.5 h-2.5" />
                            )}
                          </div>
                          {author.leetcode_username ? (
                            <a
                              href={`https://leetcode.com/${author.leetcode_username}/`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-semibold text-white/70 hover:text-[#fa586a] transition-colors flex items-center gap-1"
                            >
                              <span>@{author.username}</span>
                              <ExternalLink className="w-2.5 h-2.5 opacity-50" />
                            </a>
                          ) : (
                            <span className="font-semibold text-white/70">@{author.username}</span>
                          )}
                        </div>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-white/[0.06] text-white/60 font-semibold text-[10px] uppercase tracking-wider flex items-center gap-1">
                          <Sparkles className="w-2.5 h-2.5 text-[#ffd60a]" />
                          <span>Community Curated</span>
                        </span>
                      )}

                      <span>•</span>
                      <span>Added on {new Date(item.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Creator Delete Button */}
                    {isOwner && (
                      <button
                        onClick={() => handleDelete(item.id)}
                        disabled={deletingId === item.id}
                        className="px-2.5 py-1.5 rounded-full bg-white/[0.04] hover:bg-[#ff453a]/15 hover:border-[#ff453a]/30 border border-white/[0.06] text-white/40 hover:text-[#ff453a] transition-all flex items-center gap-1 text-xs cursor-pointer"
                        title="Delete this resource"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span className="text-[11px] font-semibold hidden sm:inline">Delete</span>
                      </button>
                    )}

                    {/* Copy Content Button */}
                    <button
                      onClick={() => handleCopy(item.id, item.content)}
                      className="px-3 py-1.5 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-white/70 hover:text-white transition-all flex items-center gap-1.5 text-xs cursor-pointer shadow-sm"
                      title="Copy content to clipboard"
                    >
                      {copiedId === item.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-[#30d158]" />
                          <span className="text-[#30d158] text-[11px] font-semibold">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span className="text-[11px] font-semibold">Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="p-5 bg-black/40 overflow-x-auto font-mono text-xs text-white/85 leading-relaxed whitespace-pre-wrap selection:bg-[#fa586a]/30">
                  {item.content}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Add Modal ── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 select-none">
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md" onClick={() => setIsModalOpen(false)} />
          <div className="relative w-full max-w-lg bg-[#1c1c1e] border border-white/[0.1] rounded-3xl shadow-modal p-6 z-10 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-2 mb-1">
              <Layers className="w-4 h-4 text-[#fa586a]" />
              <h2 className="text-xl font-bold text-white">Add to Knowledge Vault</h2>
            </div>
            <p className="text-xs text-white/40 mb-5">Share an algorithm template, cheat sheet, or company interview debrief with your squad.</p>

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
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-[#fa586a]/60 cursor-pointer"
                >
                  <option value="Template" className="bg-[#1c1c1e] text-white">Code Template</option>
                  <option value="Interview Log" className="bg-[#1c1c1e] text-white">Interview Log</option>
                  <option value="Cheat Sheet" className="bg-[#1c1c1e] text-white">Cheat Sheet</option>
                  <option value="Article" className="bg-[#1c1c1e] text-white">Article / Deep Dive</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-white/50 uppercase tracking-wider mb-1.5 pl-1">External Resource URL (Optional)</label>
                <input
                  type="url"
                  value={externalUrl}
                  onChange={(e) => setExternalUrl(e.target.value)}
                  placeholder="e.g. https://leetcode.com/discuss/... or GitHub repo link"
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl p-2.5 text-xs text-white placeholder:text-white/25 focus:outline-none focus:border-[#fa586a]/60"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-white/50 uppercase tracking-wider mb-1.5 pl-1">Content (Markdown / Code)</label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Write your template explanation, complexity analysis, and code snippet..."
                  rows={7}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl p-2.5 text-xs text-white placeholder:text-white/25 focus:outline-none focus:border-[#fa586a]/60 font-mono resize-none"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-full bg-white/[0.04] text-white/50 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !title.trim() || !content.trim()}
                  className="px-4 py-2 rounded-full bg-[#fa586a] hover:bg-[#fa586a]/90 disabled:opacity-50 text-white font-semibold text-xs transition-all shadow-glow cursor-pointer"
                >
                  {submitting ? "Publishing..." : "Publish Resource"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
