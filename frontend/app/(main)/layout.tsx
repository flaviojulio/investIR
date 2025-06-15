"use client" // AppShell and its hooks (useRouter, usePathname, useAuth) are client components
import { AppShell } from "@/components/AppShell";
import React from "react";

export default function MainAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
