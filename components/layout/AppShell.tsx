"use client";

import React, { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { NowSolvingBar } from "./NowSolvingBar";
import { MobileTabBar } from "./MobileTabBar";
import { MobileDrawer } from "./MobileDrawer";
import { SearchModal } from "../modals/SearchModal";
import { LeetCodeAutoSync } from "@/components/providers/LeetCodeAutoSync";
import { useAuth } from "@/components/providers/AuthProvider";

function BackupModeBanner() {
  const [dismissed, setDismissed] = useState(false);
  if (process.env.NEXT_PUBLIC_BACKUP_MODE !== "true") return null;
  if (dismissed) return null;
  return (
    <div
      role="status"
      className="flex items-center justify-between gap-3 border-b border-hairline bg-primary-tint px-4 py-2 text-sm leading-5 text-text-primary"
    >
      <p>You are on the backup server. Data may be up to a day old.</p>
      <button
        type="button"
        aria-label="Dismiss backup notice"
        onClick={() => setDismissed(true)}
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary"
      >
        <X className="h-4 w-4" strokeWidth={1.5} />
      </button>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsSearchOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  if (pathname?.startsWith("/login") || pathname?.startsWith("/auth")) {
    return (
      <main className="min-h-screen bg-canvas">
        <BackupModeBanner />
        {children}
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-canvas">
        <BackupModeBanner />
        {children}
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-canvas text-text-primary">
      <BackupModeBanner />
      {/* Desktop sidebar S1 */}
      <div className="shell-sidebar hidden md:flex">
        <Sidebar onSearchOpen={() => setIsSearchOpen(true)} />
      </div>

      {/* Mobile drawer S2 */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-[200] flex md:hidden">
          <div
            className="modal-scrim fixed inset-0"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            className="relative z-10 h-full w-[280px] max-w-[85vw] border-r border-hairline bg-surface shadow-overlay"
          >
            <MobileDrawer onClose={() => setIsMobileMenuOpen(false)} />
          </div>
        </div>
      )}

      <div className="shell-content">
        <Header
          onMenuToggle={() => setIsMobileMenuOpen(true)}
          onSearchOpen={() => setIsSearchOpen(true)}
        />
        <div className="shell-content-inner">
          <main className="pb-8 pt-6 md:pt-8">{children}</main>
        </div>
      </div>

      <NowSolvingBar onSearchOpen={() => setIsSearchOpen(true)} />
      <MobileTabBar />

      <SearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
      <LeetCodeAutoSync />
    </div>
  );
}
