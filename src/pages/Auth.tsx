import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Session } from "@supabase/supabase-js";
import { AlertCircle, RefreshCw, Eye, EyeOff } from "lucide-react";
import { Separator } from "@/components/ui/separator";
export default function Auth() {
  const navigate = useNavigate();
  const {
    toast
  } = useToast();
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [backendDown, setBackendDown] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [showSignInPassword, setShowSignInPassword] = useState(false);
  const [showSignUpPassword, setShowSignUpPassword] = useState(false);
  useEffect(() => {
    // ✅ CRÍTICO: Limpar TUDO ao carregar a página de login
    const cleanupOldData = async () => {
      console.log("🧹 Limpando dados antigos da página de login...");

      // Verificar se há sessão ativa
      const {
        data: {
          session
        }
      } = await supabase.auth.getSession();

      // Se não houver sessão, limpar tudo
      if (!session) {
        console.log("🗑️ Nenhuma sessão ativa, limpando localStorage/sessionStorage");
        localStorage.clear();
        sessionStorage.clear();
      } else {
        console.log("✅ Sessão ativa encontrada, redirecionando...");
        // Se há sessão, redirecionar para dashboard
        setTimeout(() => {
          navigate("/dashboard");
        }, 0);
      }
    };
    cleanupOldData();

    // ✅ CRÍTICO: Configurar listener ANTES de verificar sessão existente
    const {
      data: {
        subscription
      }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('🔐 Auth state changed:', _event, !!session);
      setSession(session);

      // ✅ CRÍTICO: Usar setTimeout(0) para evitar deadlock
      if (session) {
        setTimeout(() => {
          console.log('✅ Navegando para dashboard após auth state change');
          navigate("/dashboard");
        }, 0);
      }
    });
    return () => subscription.unsubscribe();
  }, [navigate]);
  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const email = formData.get("signup-email") as string;
    const password = formData.get("signup-password") as string;
    const fullName = formData.get("full-name") as string;
    const {
      error
    } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName
        },
        emailRedirectTo: `${window.location.origin}/dashboard`
      }
    });
    setLoading(false);
    if (error) {
      toast({
        variant: "destructive",
        title: "Erro ao criar conta",
        description: error.message
      });
    } else {
      toast({
        title: "Conta criada com sucesso!",
        description: "Você já pode fazer login."
      });
    }
  };
  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/dashboard`
        }
      });
      if (error) {
        console.error("❌ Erro ao fazer login com Google:", error);
        toast({
          variant: "destructive",
          title: "Erro ao fazer login com Google",
          description: error.message
        });
      }
    } catch (err: any) {
      console.error("❌ Exceção ao fazer login com Google:", err);
      toast({
        variant: "destructive",
        title: "Erro ao fazer login com Google",
        description: err.message || "Erro desconhecido"
      });
    } finally {
      setLoading(false);
    }
  };

  const checkBackendStatus = async () => {
    setCheckingStatus(true);
    try {
      const {
        data,
        error
      } = await supabase.from('companies').select('count').limit(1);
      if (error || !data) {
        console.error('❌ Backend check error:', error);
        setBackendDown(true);
        toast({
          variant: "destructive",
          title: "Backend ainda indisponível",
          description: "O servidor não está respondendo. Aguarde alguns minutos e tente novamente."
        });
      } else {
        setBackendDown(false);
        toast({
          title: "✅ Backend online!",
          description: "O servidor está respondendo. Você pode fazer login agora."
        });
      }
    } catch (err: any) {
      console.error('❌ Backend check exception:', err);
      setBackendDown(true);
      toast({
        variant: "destructive",
        title: "Erro ao verificar status",
        description: "Não foi possível conectar ao servidor. Tente novamente em alguns instantes."
      });
    } finally {
      setCheckingStatus(false);
    }
  };
  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setBackendDown(false);
    const formData = new FormData(e.currentTarget);
    const email = formData.get("signin-email") as string;
    const password = formData.get("signin-password") as string;
    console.log("🔐 Tentando login:", email);
    try {
      // Login direto usando Supabase Auth (para todos os usuários, inclusive super admin)
      const {
        data,
        error
      } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      if (error) {
        console.error("❌ Erro ao fazer login:", error);

        // Verificar se é erro 503 (backend fora do ar)
        if ((error as any).status === 503 || error.message.includes("503")) {
          setBackendDown(true);
          toast({
            variant: "destructive",
            title: "🔴 Backend fora do ar",
            description: "O servidor de autenticação está indisponível. Aguarde alguns minutos."
          });
          setLoading(false);
          return;
        }

        // Verificar outros erros
        if (error.message.includes("upstream") || error.message.includes("connect")) {
          setBackendDown(true);
          toast({
            variant: "destructive",
            title: "Erro de conexão com servidor",
            description: "Não foi possível conectar ao backend. Verifique o status abaixo."
          });
        } else if (error.message.includes("Invalid login credentials")) {
          toast({
            variant: "destructive",
            title: "Credenciais inválidas",
            description: "Email ou senha incorretos. Verifique suas credenciais."
          });
        } else {
          toast({
            variant: "destructive",
            title: "Erro ao fazer login",
            description: error.message
          });
        }
        setLoading(false);
        return;
      }
      if (data.session) {
        console.log("✅ Login bem-sucedido:", email);
        setBackendDown(false);

        // Verificar se é super admin
        const isSuperAdmin = email === "jeovauzumak@gmail.com";
        toast({
          title: "Login bem-sucedido!",
          description: isSuperAdmin ? "Bem-vindo Super Admin!" : "Bem-vindo de volta!"
        });

        // ✅ A navegação será feita automaticamente pelo onAuthStateChange
        // Não precisa navegar aqui para evitar navegação duplicada
      }
    } catch (err: any) {
      console.error("❌ Exceção ao fazer login:", err);

      // Verificar se é erro de conexão (Failed to fetch) - comum quando backend está pausado
      if (err.message?.includes("Failed to fetch") || err.message?.includes("NetworkError") || err.status === 0) {
        setBackendDown(true);
        toast({
          variant: "destructive",
          title: "🔴 Não foi possível conectar",
          description: "O backend pode estar pausado ou reiniciando. Aguarde alguns minutos e clique em 'Verificar Status'."
        });
      } else if (err.status === 503) {
        setBackendDown(true);
        toast({
          variant: "destructive",
          title: "Backend fora do ar",
          description: "O servidor não está respondendo (erro 503)."
        });
      } else {
        toast({
          variant: "destructive",
          title: "Erro ao fazer login",
          description: err.message || "Erro desconhecido. Tente novamente."
        });
      }
    } finally {
      setLoading(false);
    }
  };
  if (session) {
    return null;
  }
  return <div className="flex min-h-screen items-center justify-center bg-gradient-subtle p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="space-y-1 text-center">
          <img src="/logo-waze.png" alt="Waze Platform" className="mx-auto mb-4 h-16 w-16 object-contain" />
          <CardTitle className="text-2xl font-bold">FOOD DELIVERY</CardTitle>
          <CardDescription>Sistema inteligente de gestão comercial</CardDescription>
        </CardHeader>
        <CardContent>
          {backendDown && <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>🔴 Backend Indisponível</AlertTitle>
              <AlertDescription className="space-y-2">
                <p className="text-sm">O servidor não está respondendo. Se você acabou de adicionar créditos, pode levar alguns minutos para o backend reativar.</p>
                <p className="text-xs text-muted-foreground">Aguarde 2-5 minutos e clique em "Verificar Status".</p>
                <div className="flex gap-2 mt-3">
                  <Button variant="outline" size="sm" onClick={checkBackendStatus} disabled={checkingStatus} className="flex items-center gap-2">
                    <RefreshCw className={`h-3 w-3 ${checkingStatus ? 'animate-spin' : ''}`} />
                    {checkingStatus ? 'Verificando...' : 'Verificar Status'}
                  </Button>
                </div>
              </AlertDescription>
            </Alert>}
          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Cadastrar</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-email">Email</Label>
                  <Input id="signin-email" name="signin-email" type="email" placeholder="seu@email.com" required autoComplete="email" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signin-password">Senha</Label>
                  <div className="relative">
                    <Input
                    id="signin-password"
                    name="signin-password"
                    type={showSignInPassword ? "text" : "password"}
                    placeholder="••••••••"
                    required
                    autoComplete="current-password" />
                  
                    <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowSignInPassword(!showSignInPassword)}>
                    
                      {showSignInPassword ?
                    <EyeOff className="h-4 w-4 text-muted-foreground" /> :

                    <Eye className="h-4 w-4 text-muted-foreground" />
                    }
                    </Button>
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Entrando..." : "Entrar"}
                </Button>
                
                <div className="relative my-4">
                  <Separator />
                  <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
                    ou continue com
                  </span>
                </div>
                
                <Button
                type="button"
                variant="outline"
                className="w-full flex items-center justify-center gap-2"
                onClick={handleGoogleSignIn}
                disabled={loading}>
                
                  <svg className="h-5 w-5" viewBox="0 0 24 24">
                    <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4" />
                  
                    <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853" />
                  
                    <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05" />
                  
                    <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335" />
                  
                  </svg>
                  {loading ? "Conectando..." : "Continuar com Google"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="full-name">Nome Completo</Label>
                  <Input id="full-name" name="full-name" type="text" placeholder="Seu nome" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input id="signup-email" name="signup-email" type="email" placeholder="seu@email.com" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Senha</Label>
                  <div className="relative">
                    <Input
                    id="signup-password"
                    name="signup-password"
                    type={showSignUpPassword ? "text" : "password"}
                    placeholder="••••••••"
                    required
                    minLength={6} />
                  
                    <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowSignUpPassword(!showSignUpPassword)}>
                    
                      {showSignUpPassword ?
                    <EyeOff className="h-4 w-4 text-muted-foreground" /> :

                    <Eye className="h-4 w-4 text-muted-foreground" />
                    }
                    </Button>
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Criando conta..." : "Criar conta"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>;
}