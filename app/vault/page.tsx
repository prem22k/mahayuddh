"use client";

import React, { useState, useEffect } from "react";
import {
  Code2,
  Copy,
  Check,
  Building,
  Plus,
  Loader2,
  Send,
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
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-apple-accent tracking-wider uppercase mb-1">
            <Code2 className="w-3.5 h-3.5" />
            <span>Squad Knowledge Repository</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-txt-primary tracking-tight">
            Knowledge Vault
          </h1>
          <p className="text-xs text-txt-secondary mt-1">
            Reusable algorithm templates and real-world company interview debriefs stored in Supabase.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start md:self-auto">
          {/* Add Resource Button */}
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-3.5 py-1.5 rounded-pill bg-apple-accent hover:opacity-90 text-white font-semibold text-xs flex items-center gap-1.5 shadow-glow"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add to Vault</span>
          </button>

          {/* Tab Pills */}
          <div className="flex items-center p-1 bg-surface-sidebar rounded-pill border border-border-subtle">
            <button
              onClick={() => setActiveTab("Template")}
              className={cn(
                "px-3.5 py-1.5 rounded-pill text-xs font-semibold transition-all flex items-center gap-1.5",
                activeTab === "Template"
                  ? "bg-apple-accent text-white shadow-sm"
                  : "text-txt-secondary hover:text-txt-primary"
              )}
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>Templates</span>
            </button>
            <button
              onClick={() => setActiveTab("Interview Log")}
              className={cn(
                "px-3.5 py-1.5 rounded-pill text-xs font-semibold transition-all flex items-center gap-1.5",
                activeTab === "Interview Log"
                  ? "bg-apple-accent text-white shadow-sm"
                  : "text-txt-secondary hover:text-txt-primary"
              )}
            >
              <Building className="w-3.5 h-3.5" />
              <span>Interview Logs</span>
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="h-60 flex items-center justify-center gap-3 text-txt-secondary">
          <Loader2 className="w-6 h-6 animate-spin text-apple-accent" />
          <span className="text-xs">Loading vault items from database...</span>
        </div>
      ) : resources.length === 0 ? (
        <div className="p-12 text-center text-txt-secondary text-xs bg-surface-sidebar rounded-2xl border border-border-subtle">
          No resources found in this category. Click &ldquo;Add to Vault&rdquo; to contribute!
        </div>
      ) : (
        <div className="space-y-6">
          {resources.map((item) => (
            <div
              key={item.id}
              className="bg-surface-sidebar border border-border-subtle rounded-2xl overflow-hidden shadow-subtle"
            >
              <div className="p-5 border-b border-border-subtle flex items-center justify-between bg-surface-muted/50">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-apple-purple/15 text-apple-purple border border-apple-purple/30 text-[10px] font-bold">
                      {item.category}
                    </span>
                    <h3 className="text-sm font-bold text-txt-primary">{item.title}</h3>
                  </div>
                  <span className="text-[11px] text-txt-tertiary mt-1 block">
                    Added on {new Date(item.created_at).toLocaleDateString()}
                  </span>
                </div>

                <button
                  onClick={() => handleCopy(item.id, item.content)}
                  className="p-1.5 rounded-lg bg-surface-base hover:bg-surface-raised border border-border-subtle text-txt-secondary hover:text-txt-primary transition-all flex items-center gap-1 text-xs"
                  title="Copy content"
                >
                  {copiedId === item.id ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-apple-green" />
                      <span className="text-apple-green text-[11px]">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span className="text-[11px]">Copy</span>
                    </>
                  )}
                </button>
              </div>

              <div className="p-5 bg-surface-base/90 overflow-x-auto font-mono text-xs text-txt-primary leading-relaxed whitespace-pre-wrap">
                {item.content}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md" onClick={() => setIsModalOpen(false)} />
          <div className="relative w-full max-w-lg bg-surface-muted border border-border-strong rounded-2xl shadow-modal p-6 z-10 animate-in fade-in zoom-in-95">
            <h2 className="text-xl font-bold text-txt-primary mb-1">Add to Knowledge Vault</h2>
            <p className="text-xs text-txt-secondary mb-5">Share an algorithm template or interview debrief.</p>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-txt-secondary mb-1">Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., 'Monotonic Queue Pattern' or 'Meta Phone Screen Log'"
                  className="w-full bg-surface-sidebar border border-border-subtle rounded-lg p-2.5 text-xs text-txt-primary focus:outline-none focus:border-apple-accent"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-txt-secondary mb-1">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as ResourceCategory)}
                  className="w-full bg-surface-sidebar border border-border-subtle rounded-lg p-2.5 text-xs text-txt-primary focus:outline-none focus:border-apple-accent"
                >
                  <option value="Template">Code Template</option>
                  <option value="Interview Log">Interview Log</option>
                  <option value="Cheat Sheet">Cheat Sheet</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-txt-secondary mb-1">Content (Markdown / Code)</label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Write your template explanation, complexity, and code snippet..."
                  rows={6}
                  className="w-full bg-surface-sidebar border border-border-subtle rounded-lg p-2.5 text-xs text-txt-primary focus:outline-none focus:border-apple-accent font-mono resize-none"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border-subtle">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-pill bg-surface-raised text-txt-secondary hover:text-txt-primary text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-pill bg-apple-accent hover:opacity-90 text-white text-xs font-semibold shadow-glow flex items-center gap-1.5 disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  <span>Save to Vault</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
