"use client";

import React, { useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { NowSolvingBar } from "./NowSolvingBar";
import { SearchModal } from "../modals/SearchModal";
import { useAuth } from "@/components/providers/AuthProvider";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // If on login page or auth callbacks, show clean full-page view
  if (pathname?.startsWith("/login") || pathname?.startsWith("/auth")) {
    return <main className="min-h-screen bg-surface-base">{children}</main>;
  }

  // If not logged in, user will be redirected to /login by middleware
  if (!user) {
    return <main className="min-h-screen bg-surface-base">{children}</main>;
  }

  return (
    <div className="min-h-screen bg-surface-base text-txt-primary">
      {/* ── Floating Sidebar (desktop) ──────────────────── */}
      <div className="hidden md:flex floating-sidebar">
        <Sidebar onSearchOpen={() => setIsSearchOpen(true)} />
      </div>

      {/* ── Mobile Drawer Overlay ───────────────────────── */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-[200] flex md:hidden">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <div className="relative w-64 max-w-[80vw] h-full z-10">
            <div className="h-full rounded-r-2xl overflow-hidden glass-panel border-r border-border-subtle">
              <Sidebar
                onSearchOpen={() => {
                  setIsMobileMenuOpen(false);
                  setIsSearchOpen(true);
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Main Content Area ───────────────────────────── */}
      <div className="main-content-area">
        <Header
          onMenuToggle={() => setIsMobileMenuOpen(true)}
          onSearchOpen={() => setIsSearchOpen(true)}
        />
        <main className="p-4 md:p-8 max-w-7xl mx-auto w-full">
          {children}
        </main>
      </div>

      {/* ── Floating Bottom Bar (Now Solving) ───────────── */}
      <NowSolvingBar />

      {/* ── Global Cmd+K Search Modal ───────────────────── */}
      <SearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
      />
    </div>
  );
}
