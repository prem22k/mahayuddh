"use client";

import React, { useState, useEffect, useRef } from "react";
import { X, Search, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { getAllProblems, createCustomList } from "@/lib/data/sheets";
import { difficultyBadgeClass } from "@/components/ui/DifficultyBadge";
import { ModalShell } from "@/components/ui/ModalShell";
import { Spinner } from "@/components/ui/Spinner";
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
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ModalShell
      label="Create new problem list"
      onClose={onClose}
      zIndexClass="z-[300]"
      maxWidthClass="max-w-xl"
      panelClassName="shadow-[0_25px_70px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col max-h-[85vh]"
    >
        {/* Header */}
        <div className="p-5 border-b border-hairline flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-text-primary tracking-tight mt-0.5">
              Create New Problem List
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-text-secondary hover:text-text-primary rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleCreate} className="flex-1 overflow-y-auto p-5 space-y-4">
          {error && (
            <div className="p-3 bg-error/10 border border-error/25 text-error rounded-xl text-xs font-medium">
              {error}
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">
              List Name <span className="text-primary">*</span>
            </label>
            <input
              ref={titleInputRef}
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Google Interview Prep, Graph Masterclass"
              className="w-full px-3.5 py-2 bg-well border border-hairline focus:border-primary/60 rounded-xl text-xs text-text-primary placeholder:text-text-disabled focus:outline-none transition-colors"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">
              Description (Optional)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Must-solve problems discussed during squad mock interview"
              className="w-full px-3.5 py-2 bg-well border border-hairline focus:border-primary/60 rounded-xl text-xs text-text-primary placeholder:text-text-disabled focus:outline-none transition-colors"
            />
          </div>

          {/* Problem Selector */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-text-secondary">
                Add Problems ({selectedSlugs.length} selected)
              </label>
              {selectedSlugs.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedSlugs([])}
                  className="text-[11px] text-text-secondary hover:text-error transition-colors"
                >
                  Clear all
                </button>
              )}
            </div>

            {/* Problem Search Bar */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-text-tertiary absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search problems by name or category..."
                className="w-full pl-8 pr-3 py-1.5 bg-surface-overlay border border-hairline rounded-xl text-xs text-text-primary placeholder:text-text-disabled focus:outline-none focus:border-primary/60"
              />
            </div>

            {/* Problem Selection List */}
            <div className="max-h-48 overflow-y-auto rounded-xl border border-hairline bg-black/30 divide-y divide-hairline p-1">
              {loadingProblems ? (
                <div className="p-4 text-center text-text-secondary text-xs flex items-center justify-center gap-2">
                  <Spinner size="sm" tone="soft" />
                  <span>Loading problems...</span>
                </div>
              ) : filteredProblems.length === 0 ? (
                <div className="p-4 text-center text-text-secondary text-xs">
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
                          ? "bg-primary text-on-primary hover:bg-primary-hover"
                          : "hover:bg-well text-text-secondary"
                      )}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <div
                          className={cn(
                            "w-4 h-4 rounded flex items-center justify-center border text-[10px] transition-colors shrink-0",
                            isSelected
                              ? "bg-primary border-primary text-on-primary"
                              : "border-hairline-strong text-transparent"
                          )}
                        >
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                        <span className="font-medium truncate">{p.title}</span>
                        <span
                          className={cn(
                            "px-1.5 py-0.2 rounded-full text-[9px] font-semibold border shrink-0",
                            difficultyBadgeClass()
                          )}
                        >
                          {p.difficulty}
                        </span>
                      </div>
                      <span className="text-[10px] text-text-tertiary shrink-0 pl-2">
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
        <div className="p-4 bg-black/40 border-t border-hairline flex items-center justify-between">
          <span className="text-xs text-text-secondary">
            {selectedSlugs.length} {selectedSlugs.length === 1 ? "problem" : "problems"} included
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-full border border-hairline text-text-secondary hover:text-text-primary text-xs font-semibold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={isSubmitting || !title.trim()}
              className="px-4 py-1.5 rounded-full bg-primary text-on-primary hover:bg-primary-hover text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lifted cursor-pointer flex items-center gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <Spinner size="xs" tone="inverse" className="border-surface-overlay" />
                  <span>Creating...</span>
                </>
              ) : (
                <span>Create List</span>
              )}
            </button>
          </div>
        </div>
    </ModalShell>
  );
}
