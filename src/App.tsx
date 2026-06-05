import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Auth from "./pages/Auth";
import Analytics from "./pages/Analytics";
import Leads from "./pages/Leads";
import Pedidos from "./pages/Pedidos";

import Conversas from "./pages/Conversas";
import AgendaPublica from "./pages/AgendaPublica";
import IA from "./pages/IA";
import Configuracoes from "./pages/Configuracoes";
import Relatorios from "./pages/Relatorios";
import PublicMeeting from "./pages/PublicMeeting";
import CapturaPublica from "./pages/CapturaPublica";
import CaixaPDV from "./pages/CaixaPDV";
import Produtos from "./pages/Produtos";
import CardapioDigital from "./pages/CardapioDigital";
import CardapioPublico from "./pages/CardapioPublico";
import OAuthCallback from "./pages/OAuthCallback";
import GmailCallback from "./pages/GmailCallback";
import { MainLayout } from "./components/layout/MainLayout";
import NotFound from "./pages/NotFound";
import { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from "./components/ui/button";

const queryClient = new QueryClient();

// Error Boundary component
class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: string }> {
  state = { hasError: false, error: '' };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Erro capturado:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-6">
          <div className="max-w-md text-center space-y-4">
            <h1 className="text-2xl font-bold text-destructive">Ocorreu um erro</h1>
            <p className="text-muted-foreground">{this.state.error}</p>
            <p className="text-sm">Verifique o console (F12) para mais detalhes ou recarregue a página.</p>
            <Button onClick={() => window.location.reload()}>Recarregar</Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <TooltipProvider>
        <ErrorBoundary>
          <Toaster />
          <Sonner />
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/oauth/callback" element={<OAuthCallback />} />
            <Route path="/oauth/gmail/callback" element={<GmailCallback />} />
            <Route path="/agenda/:slug" element={<AgendaPublica />} />
            <Route path="/meeting/:meetingId" element={<PublicMeeting />} />
            <Route path="/captura/:companyId" element={<CapturaPublica />} />
            <Route path="/cardapio/:slug" element={<CardapioPublico />} />
            <Route path="/" element={<MainLayout />}>
              <Route index element={<Navigate to="/analytics" replace />} />
              <Route path="dashboard" element={<Navigate to="/analytics" replace />} />
              <Route path="leads" element={<Leads />} />
              <Route path="kanban" element={<Pedidos />} />
              
              <Route path="produtos" element={<Produtos />} />
              <Route path="cardapio-digital" element={<CardapioDigital />} />
              <Route path="analytics" element={<Analytics />} />
              <Route path="conversas" element={<Conversas />} />
              <Route path="ia" element={<IA />} />
              <Route path="relatorios" element={<Relatorios />} />
              <Route path="configuracoes" element={<Configuracoes />} />
              <Route path="financeiro" element={<CaixaPDV />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </ErrorBoundary>
      </TooltipProvider>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;
