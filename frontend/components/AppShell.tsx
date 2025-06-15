"use client"
import React, { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LogOut, TrendingUp, PlusCircle, UploadCloud } from "lucide-react";
import { AddOperation } from "@/components/AddOperation"; // Assuming this path is correct
import { UploadOperations } from "@/components/UploadOperations"; // Assuming this path is correct

// Define a type for the props if you want to pass more than just children
interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    // Determine active tab based on pathname
    // This logic might need to be more robust depending on your route structure
    if (pathname === "/") {
      setActiveTab("overview");
    } else if (pathname.startsWith("/proventos")) { // Use startsWith for potential sub-routes
      setActiveTab("proventos");
    } else if (pathname.startsWith("/carteira")) {
      setActiveTab("carteira");
    } else if (pathname.startsWith("/operacoes")) {
      setActiveTab("operacoes");
    } else if (pathname.startsWith("/resultados")) {
      setActiveTab("resultados");
    } else if (pathname.startsWith("/darf")) {
      setActiveTab("darf");
    } else if (pathname.startsWith("/relatorios")) {
      setActiveTab("relatorios");
    } else if (pathname.startsWith("/configuracoes")) {
      setActiveTab("configuracoes");
    } else {
        // Fallback or default if no match, e.g. if on a sub-page not directly in tabs
        const firstSegment = pathname.substring(1).split("/")[0];
        setActiveTab(firstSegment || "overview");
    }
  }, [pathname]);

  const handleTabChange = (value: string) => {
    // This function now solely handles navigation based on tab clicks.
    // The activeTab state will be updated by the useEffect hook listening to pathname changes.
    if (value === "overview") router.push("/");
    else if (value === "proventos") router.push("/proventos");
    else if (value === "carteira") router.push("/carteira");
    else if (value === "operacoes") router.push("/operacoes");
    else if (value === "resultados") router.push("/resultados");
    else if (value === "darf") router.push("/darf");
    else if (value === "relatorios") router.push("/relatorios");
    else if (value === "configuracoes") router.push("/configuracoes");
    // Note: setActiveTab(value) is removed from here; useEffect handles it.
  };

  // Placeholder for handleDataUpdate if needed by AddOperation/UploadOperations directly in AppShell
  // If these dialogs trigger global state changes or context updates, they might not need this prop.
  // For now, we'll assume they might need a way to signal data changes.
  const handleDataUpdate = () => {
    // This function would typically trigger a re-fetch or update of global data.
    // For now, it's a placeholder. If Dashboard.tsx (now page.tsx for overview)
    // is the one fetching data, this might need to be passed down or handled via context.
    // router.refresh(); // Simplest way to re-run server components and fetch data in Next.js App Router
    // Or use a more specific state management solution.
    console.log("AppShell: handleDataUpdate triggered. Consider implementing data refresh.");
  };


  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      {/* Header */}
      <header className="bg-white dark:bg-slate-800 shadow-sm border-b dark:border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <TrendingUp className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              <h1 className="text-xl font-semibold text-gray-900 dark:text-slate-100">Carteira de Ações</h1>
            </div>

            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600 dark:text-slate-300">Olá, {user?.nome_completo || user?.username}</span>
              <Button variant="outline" size="sm" onClick={logout}>
                <LogOut className="h-4 w-4 mr-2" />
                Sair
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Wrapper (includes TabsList and children) */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
         {/* Action Buttons - kept in AppShell for global access */}
         <div className="mb-6 flex flex-wrap gap-4">
          <Dialog>
            <DialogTrigger asChild>
              <Button size="lg" variant="outline">
                <PlusCircle className="h-5 w-5 mr-2" />
                Cadastrar Nova Operação
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Cadastrar Nova Operação</DialogTitle>
              </DialogHeader>
              <AddOperation onSuccess={handleDataUpdate} />
            </DialogContent>
          </Dialog>

          <Dialog>
            <DialogTrigger asChild>
              <Button size="lg" variant="outline">
                <UploadCloud className="h-5 w-5 mr-2" />
                Importar Operações B3
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Importar Operações da B3</DialogTitle>
              </DialogHeader>
              <UploadOperations onSuccess={handleDataUpdate} />
            </DialogContent>
          </Dialog>
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-8">
            {/* Main application page routes */}
            <TabsTrigger value="overview">Visão Geral</TabsTrigger>
            <TabsTrigger value="carteira">Carteira</TabsTrigger>
            <TabsTrigger value="operacoes">Operações</TabsTrigger>
            <TabsTrigger value="proventos">Proventos</TabsTrigger>
            <TabsTrigger value="resultados">Resultados</TabsTrigger>
            <TabsTrigger value="darf">DARF</TabsTrigger>
            <TabsTrigger value="relatorios">Relatórios</TabsTrigger>
            <TabsTrigger value="configuracoes">Config.</TabsTrigger>
          </TabsList>

          {/* Content area for child pages */}
          <div className="mt-6">
            {children}
          </div>
        </Tabs>
      </main>
    </div>
  );
}
