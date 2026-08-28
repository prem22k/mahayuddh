"use client";

import React, { useState, useEffect, useRef } from "react";
import { X, Plus, Search, Check, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getAllProblems, createCustomList } from "@/lib/data/sheets";
import { ListProblem } from "@/types/database";
import { useAuth } from "@/components/providers/AuthProvider";

interface CreateListModalProps {
  isOpen: boolean;
  onClose: () => void;
  onListCreated: (slug: string) => void;
}

export function CreateListModal({
  isOpen,
  onClose,
  onListCreated,
}: CreateListModalProps) {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [allProblems, setAllProblems] = useState<ListProblem[]>([]);
  const [selectedSlugs, setSelectedSlugs] = useState<string[]>([]);
  const [loadingProblems, setLoadingProblems] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function loadIndex() {
      if (isOpen && allProblems.length === 0) {
        setLoadingProblems(true);
        try {
          const problems = await getAllProblems();
          setAllProblems(problems);
        } catch (e) {
          console.error("Failed to load problem index:", e);
        } finally {
          setLoadingProblems(false);
        }
      }
    }
    loadIndex();
  }, [isOpen, allProblems.length]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => titleInputRef.current?.focus(), 50);
    } else {
      setTitle("");
      setDescription("");
      setSearchQuery("");
      setSelectedSlugs([]);
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredProblems = allProblems.filter(
    (p) =>
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.title_slug.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleProblemSelection = (slug: string) => {
    setSelectedSlugs((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Please enter a title for the list");
      return;
    }
    if (!user) {
      setError("You must be logged in to create a list");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await createCustomList(
        user.id,
        title,
        description,
        selectedSlugs
      );

      if (res.success && res.slug) {
        onListCreated(res.slug);
        onClose();
      } else {
        setError(res.error || "Failed to create list");
      }
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getDifficultyBadge = (diff: string) => {
    switch (diff?.toLowerCase()) {
      case "easy":
        return "text-[#30d158] bg-[#30d158]/10 border-[#30d158]/25";
      case "medium":
        return "text-[#ff9f0a] bg-[#ff9f0a]/10 border-[#ff9f0a]/25";
      case "hard":
        return "text-[#ff453a] bg-[#ff453a]/10 border-[#ff453a]/25";
      default:
        return "text-white/40";
    }
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 select-none">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-xl bg-[#1c1c1e] border border-white/[0.1] rounded-3xl shadow-[0_25px_70px_rgba(0,0,0,0.8)] overflow-hidden z-10 flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-5 border-b border-white/[0.06] flex items-center justify-between">
          <div>
            <span className="text-[10px] text-[#fa586a] font-bold uppercase tracking-[0.16em]">
              Squad Custom Playlist
            </span>
            <h2 className="text-xl font-extrabold text-white tracking-tight mt-0.5">
              Create New Problem List
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-white/40 hover:text-white rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleCreate} className="flex-1 overflow-y-auto p-5 space-y-4">
          {error && (
            <div className="p-3 bg-[#ff453a]/10 border border-[#ff453a]/25 text-[#ff453a] rounded-xl text-xs font-medium">
              {error}
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-white/70 mb-1.5">
              List Name <span className="text-[#fa586a]">*</span>
            </label>
            <input
              ref={titleInputRef}
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Google Interview Prep, Graph Masterclass"
              className="w-full px-3.5 py-2 bg-white/[0.04] border border-white/[0.08] focus:border-[#fa586a]/60 rounded-xl text-xs text-white placeholder:text-white/25 focus:outline-none transition-colors"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-white/70 mb-1.5">
              Description (Optional)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Must-solve problems discussed during squad mock interview"
              className="w-full px-3.5 py-2 bg-white/[0.04] border border-white/[0.08] focus:border-[#fa586a]/60 rounded-xl text-xs text-white placeholder:text-white/25 focus:outline-none transition-colors"
            />
          </div>

          {/* Problem Selector */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-white/70">
                Add Problems ({selectedSlugs.length} selected)
              </label>
              {selectedSlugs.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedSlugs([])}
                  className="text-[11px] text-white/40 hover:text-[#ff453a] transition-colors"
                >
                  Clear all
                </button>
              )}
            </div>

            {/* Problem Search Bar */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-white/30 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search problems by name or category..."
                className="w-full pl-8 pr-3 py-1.5 bg-white/[0.03] border border-white/[0.06] rounded-xl text-xs text-white placeholder:text-white/25 focus:outline-none focus:border-[#fa586a]/60"
              />
            </div>

            {/* Problem Selection List */}
            <div className="max-h-48 overflow-y-auto rounded-xl border border-white/[0.06] bg-black/30 divide-y divide-white/[0.03] p-1">
              {loadingProblems ? (
                <div className="p-4 text-center text-white/40 text-xs flex items-center justify-center gap-2">
                  <div className="w-3.5 h-3.5 animate-spin rounded-full border-2 border-white/20 border-t-[#fa586a]" />
                  <span>Loading problems...</span>
                </div>
              ) : filteredProblems.length === 0 ? (
                <div className="p-4 text-center text-white/40 text-xs">
                  No problems match your query.
                </div>
              ) : (
                filteredProblems.slice(0, 30).map((p) => {
                  const isSelected = selectedSlugs.includes(p.title_slug);
                  return (
                    <div
                      key={p.id}
                      onClick={() => toggleProblemSelection(p.title_slug)}
                      className={cn(
                        "flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer transition-colors",
                        isSelected
                          ? "bg-[#fa586a]/15 text-white"
                          : "hover:bg-white/[0.04] text-white/70"
                      )}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <div
                          className={cn(
                            "w-4 h-4 rounded flex items-center justify-center border text-[10px] transition-colors shrink-0",
                            isSelected
                              ? "bg-[#fa586a] border-[#fa586a] text-white"
                              : "border-white/20 text-transparent"
                          )}
                        >
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                        <span className="font-medium truncate">{p.title}</span>
                        <span
                          className={cn(
                            "px-1.5 py-0.2 rounded-full text-[9px] font-semibold border shrink-0",
                            getDifficultyBadge(p.difficulty)
                          )}
                        >
                          {p.difficulty}
                        </span>
                      </div>
                      <span className="text-[10px] text-white/30 shrink-0 pl-2">
                        {p.category}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="p-4 bg-black/40 border-t border-white/[0.06] flex items-center justify-between">
          <span className="text-xs text-white/40">
            {selectedSlugs.length} {selectedSlugs.length === 1 ? "problem" : "problems"} included
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-full border border-white/[0.08] text-white/60 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={isSubmitting || !title.trim()}
              className="px-4 py-1.5 rounded-full bg-[#fa586a] hover:bg-[#fa586a]/90 text-white text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-glow cursor-pointer flex items-center gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3 h-3 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  <span>Creating...</span>
                </>
              ) : (
                <span>Create List</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
