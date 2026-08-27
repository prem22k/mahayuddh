"use client";

import React, { useState } from "react";
import {
  Code2,
  FileText,
  Copy,
  Check,
  Building,
  Sparkles,
  BookOpen,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface TemplateItem {
  id: string;
  title: string;
  category: string;
  timeComplexity: string;
  spaceComplexity: string;
  code: string;
  description: string;
}

interface InterviewLog {
  id: string;
  company: string;
  role: string;
  author: string;
  date: string;
  roundsSummary: string;
  questions: Array<{ name: string; difficulty: string; topic: string }>;
}

const SAMPLE_TEMPLATES: TemplateItem[] = [
  {
    id: "1",
    title: "Monotonic Decreasing Stack (Next Greater Element)",
    category: "Stack",
    timeComplexity: "O(N)",
    spaceComplexity: "O(N)",
    description: "Standard template to find next greater element to the right in linear time.",
    code: `def next_greater_elements(nums: list[int]) -> list[int]:
    n = len(nums)
    res = [-1] * n
    stack = []  # stores indices

    for i in range(n):
        while stack and nums[i] > nums[stack[-1]]:
            prev_idx = stack.pop()
            res[prev_idx] = nums[i]
        stack.append(i)
    return res`,
  },
  {
    id: "2",
    title: "Disjoint Set Union (Union-Find with Path Compression)",
    category: "Graphs",
    timeComplexity: "O(α(N))",
    spaceComplexity: "O(N)",
    description: "Efficient connected component management with path compression & union by rank.",
    code: `class UnionFind:
    def __init__(self, size: int):
        self.parent = list(range(size))
        self.rank = [1] * size

    def find(self, x: int) -> int:
        if self.parent[x] != x:
            self.parent[x] = self.find(self.parent[x])  # Path compression
        return self.parent[x]

    def union(self, x: int, y: int) -> bool:
        root_x, root_y = self.find(x), self.find(y)
        if root_x == root_y:
            return False
        if self.rank[root_x] > self.rank[root_y]:
            self.parent[root_y] = root_x
        elif self.rank[root_x] < self.rank[root_y]:
            self.parent[root_x] = root_y
        else:
            self.parent[root_y] = root_x
            self.rank[root_x] += 1
        return True`,
  },
  {
    id: "3",
    title: "Binary Search on Answer (Predicate/Feasibility)",
    category: "Binary Search",
    timeComplexity: "O(N log(Range))",
    spaceComplexity: "O(1)",
    description: "Template for min-max capacity / rate allocation problems (e.g. Koko Eating Bananas).",
    code: `def binary_search_answer(nums: list[int], k: int) -> int:
    def is_valid(target: int) -> bool:
        # Feasibility check logic
        pass

    low, high = min_possible, max_possible
    ans = high

    while low <= high:
        mid = (low + high) // 2
        if is_valid(mid):
            ans = mid
            high = mid - 1  # Minimize answer
        else:
            low = mid + 1
    return ans`,
  },
];

const SAMPLE_INTERVIEWS: InterviewLog[] = [
  {
    id: "1",
    company: "Google",
    role: "Software Engineer (L4)",
    author: "Prem Sai",
    date: "August 2026",
    roundsSummary: "3 Coding Rounds + 1 System Design. Focus was heavily on graph cycle detection and dynamic programming on trees.",
    questions: [
      { name: "Parallel Courses III (LC #2050)", difficulty: "Hard", topic: "Topological Sort & DP" },
      { name: "Longest Valid Parentheses (LC #32)", difficulty: "Hard", topic: "Stack / DP" },
    ],
  },
  {
    id: "2",
    company: "Uber",
    role: "Software Engineer II",
    author: "Rahul K",
    date: "July 2026",
    roundsSummary: "Online Assessment + 2 Tech Interviews. Fast-paced graph traversal and state memoization.",
    questions: [
      { name: "Cheapest Flights Within K Stops (LC #787)", difficulty: "Medium", topic: "Bellman-Ford / Dijkstra" },
      { name: "Sliding Window Maximum (LC #239)", difficulty: "Hard", topic: "Monotonic Queue" },
    ],
  },
];

export default function VaultPage() {
  const [activeTab, setActiveTab] = useState<"templates" | "interviews">("templates");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (id: string, code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
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
            Reusable algorithm templates and real-world company interview debriefs.
          </p>
        </div>

        {/* Tab Pills */}
        <div className="flex items-center p-1 bg-surface-sidebar rounded-pill border border-border-subtle self-start md:self-auto">
          <button
            onClick={() => setActiveTab("templates")}
            className={cn(
              "px-4 py-1.5 rounded-pill text-xs font-semibold transition-all flex items-center gap-1.5",
              activeTab === "templates"
                ? "bg-apple-accent text-white shadow-sm"
                : "text-txt-secondary hover:text-txt-primary"
            )}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>Code Templates</span>
          </button>
          <button
            onClick={() => setActiveTab("interviews")}
            className={cn(
              "px-4 py-1.5 rounded-pill text-xs font-semibold transition-all flex items-center gap-1.5",
              activeTab === "interviews"
                ? "bg-apple-accent text-white shadow-sm"
                : "text-txt-secondary hover:text-txt-primary"
            )}
          >
            <Building className="w-3.5 h-3.5" />
            <span>Interview Logs</span>
          </button>
        </div>
      </div>

      {/* Content */}
      {activeTab === "templates" ? (
        <div className="space-y-6">
          {SAMPLE_TEMPLATES.map((tmpl) => (
            <div
              key={tmpl.id}
              className="bg-surface-sidebar border border-border-subtle rounded-2xl overflow-hidden shadow-subtle"
            >
              {/* Card Header */}
              <div className="p-5 border-b border-border-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface-muted/50">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-apple-purple/15 text-apple-purple border border-apple-purple/30 text-[10px] font-bold">
                      {tmpl.category}
                    </span>
                    <h3 className="text-sm font-bold text-txt-primary">{tmpl.title}</h3>
                  </div>
                  <p className="text-xs text-txt-secondary mt-1">{tmpl.description}</p>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <div className="flex items-center gap-2 font-mono text-[11px] text-txt-tertiary">
                    <span className="px-2 py-0.5 rounded bg-surface-base border border-border-subtle">
                      Time: {tmpl.timeComplexity}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-surface-base border border-border-subtle">
                      Space: {tmpl.spaceComplexity}
                    </span>
                  </div>

                  <button
                    onClick={() => handleCopy(tmpl.id, tmpl.code)}
                    className="p-1.5 rounded-lg bg-surface-base hover:bg-surface-raised border border-border-subtle text-txt-secondary hover:text-txt-primary transition-all flex items-center gap-1 text-xs"
                    title="Copy snippet"
                  >
                    {copiedId === tmpl.id ? (
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
              </div>

              {/* Code Snippet Box */}
              <div className="p-4 bg-surface-base/90 overflow-x-auto font-mono text-xs text-txt-primary leading-relaxed">
                <pre>
                  <code>{tmpl.code}</code>
                </pre>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {SAMPLE_INTERVIEWS.map((log) => (
            <div
              key={log.id}
              className="bg-surface-sidebar border border-border-subtle rounded-2xl p-5 shadow-subtle flex flex-col justify-between space-y-4"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 rounded-full bg-apple-accent/15 text-apple-accent border border-apple-accent/30 text-xs font-bold">
                    {log.company}
                  </span>
                  <span className="text-[11px] text-txt-tertiary">
                    {log.date} • By @{log.author}
                  </span>
                </div>

                <h3 className="text-base font-bold text-txt-primary mt-3">{log.role}</h3>
                <p className="text-xs text-txt-secondary mt-2 leading-relaxed">
                  {log.roundsSummary}
                </p>

                {/* Questions List */}
                <div className="mt-4 space-y-2">
                  <span className="text-[11px] font-semibold text-txt-tertiary uppercase tracking-wider">
                    Questions Encountered
                  </span>
                  {log.questions.map((q, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-xl bg-surface-muted border border-border-subtle flex items-center justify-between text-xs"
                    >
                      <div className="flex flex-col">
                        <span className="font-semibold text-txt-primary">{q.name}</span>
                        <span className="text-[11px] text-txt-secondary">{q.topic}</span>
                      </div>
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded text-[10px] font-semibold",
                          q.difficulty === "Hard"
                            ? "text-apple-red bg-apple-red/10"
                            : "text-apple-orange bg-apple-orange/10"
                        )}
                      >
                        {q.difficulty}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
