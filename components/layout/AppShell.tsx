"use client";

import React, { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { NowSolvingBar } from "./NowSolvingBar";
import { MobileTabBar } from "./MobileTabBar";
import { SearchModal } from "../modals/SearchModal";
import { LeetCodeAutoSync } from "@/components/providers/LeetCodeAutoSync";
import { useAuth } from "@/components/providers/AuthProvider";

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
    return <main className="min-h-screen bg-canvas">{children}</main>;
  }

  if (!user) {
    return <main className="min-h-screen bg-canvas">{children}</main>;
  }

  return (
    <div className="min-h-screen bg-canvas text-text-primary">
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
            className="relative z-10 h-full w-64 max-w-[80vw] border-r border-hairline bg-surface"
          >
            <Sidebar
              onSearchOpen={() => {
                setIsMobileMenuOpen(false);
                setIsSearchOpen(true);
              }}
            />
          </div>
        </div>
      )}

      <div className="shell-content">
        <div className="shell-content-inner">
          <Header
            onMenuToggle={() => setIsMobileMenuOpen(true)}
            onSearchOpen={() => setIsSearchOpen(true)}
          />
          <main className="pb-8 pt-6">{children}</main>
        </div>
      </div>

      <NowSolvingBar onSearchOpen={() => setIsSearchOpen(true)} />
      <MobileTabBar />

      <SearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
      <LeetCodeAutoSync />
    </div>
  );
}
