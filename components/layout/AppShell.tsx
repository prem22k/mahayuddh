"use client";

import React, { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { NowSolvingBar } from "./NowSolvingBar";
import { SearchModal } from "../modals/SearchModal";
import { useAuth } from "@/components/providers/AuthProvider";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isAuthPage = pathname?.startsWith("/login") || pathname?.startsWith("/auth");

  // On auth pages or before client mount on auth routes, render clean page without sidebar
  if (!mounted || isAuthPage || !user) {
    return <div className="min-h-screen bg-surface-base text-txt-primary">{children}</div>;
  }

  return (
    <div className="min-h-screen bg-surface-base text-txt-primary flex">
      {/* Desktop Fixed Sidebar */}
      <div className="hidden md:block w-60 shrink-0">
        <Sidebar onSearchOpen={() => setIsSearchOpen(true)} />
      </div>

      {/* Mobile Drawer Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <div className="relative w-64 max-w-[80vw] h-full bg-surface-sidebar z-10 animate-in slide-in-from-left">
            <Sidebar
              onSearchOpen={() => {
                setIsMobileMenuOpen(false);
                setIsSearchOpen(true);
              }}
            />
          </div>
        </div>
      )}

      {/* Main Workspace Area */}
      <div className="flex-1 flex flex-col min-w-0 pb-20">
        <Header
          onMenuToggle={() => setIsMobileMenuOpen(true)}
          onSearchOpen={() => setIsSearchOpen(true)}
        />
        <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full">
          {children}
        </main>
      </div>

      {/* Persistent "Now Solving" Player Bar */}
      <NowSolvingBar />

      {/* Global Cmd+K Search Modal */}
      <SearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </div>
  );
}
