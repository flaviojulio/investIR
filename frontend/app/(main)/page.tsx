"use client"
import { Dashboard } from "@/components/Dashboard";

// This page is now part of the (main) route group, which uses AppShell.
// AppShell and AuthProvider are expected to handle authentication checks.
// The Dashboard component itself handles its own data loading.

export default function OverviewPage() {
  return <Dashboard />;
}
