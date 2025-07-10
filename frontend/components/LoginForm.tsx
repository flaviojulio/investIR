"use client"

import type React from "react"

import { useState } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { TrendingUp, BarChart3, PieChart, Shield, Sparkles, Eye, EyeOff, User, Lock } from "lucide-react"

export function LoginForm() {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const { login } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      await login(username, password)
    } catch (error: any) {
      let displayErrorMessage = "Ocorreu um erro ao tentar fazer login.";
      const detail = error.response?.data?.detail;

      if (typeof detail === 'string') {
        displayErrorMessage = detail;
      } else if (typeof detail === 'object' && detail !== null) {
        // Check for Pydantic validation error structure
        if (Array.isArray(detail) && detail.length > 0 && detail[0].msg && typeof detail[0].msg === 'string') {
          displayErrorMessage = detail[0].msg;
        } else if (typeof detail.msg === 'string') { // For {type, loc, msg, input}
          displayErrorMessage = detail.msg;
        } else if (typeof detail.message === 'string') { 
          displayErrorMessage = detail.message;
        } else {
          console.error("Unknown error object structure:", detail);
          displayErrorMessage = "Ocorreu um erro desconhecido ao processar os detalhes do erro.";
        }
      } else if (typeof error.message === 'string' && error.message) {
        displayErrorMessage = error.message;
      }
      
      setError(displayErrorMessage);
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-100 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background decorativo */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-blue-400/20 to-purple-400/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-br from-indigo-400/20 to-pink-400/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-br from-emerald-400/10 to-blue-400/10 rounded-full blur-3xl animate-pulse delay-500"></div>
      </div>

      <div className="w-full max-w-7xl grid lg:grid-cols-2 gap-12 items-center relative z-10">
        {/* Seção de apresentação modernizada */}
        <div className="hidden lg:block space-y-8">
          {/* Header com animação */}
          <div className="text-center space-y-6">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="h-14 w-14 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-xl rotate-12 hover:rotate-0 transition-transform duration-500">
                <TrendingUp className="h-8 w-8 text-white" />
              </div>
              <div className="h-12 w-12 bg-gradient-to-br from-emerald-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-xl -rotate-12 hover:rotate-0 transition-transform duration-700">
                <BarChart3 className="h-6 w-6 text-white" />
              </div>
              <div className="h-10 w-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl flex items-center justify-center shadow-xl rotate-45 hover:rotate-0 transition-transform duration-300">
                <PieChart className="h-5 w-5 text-white" />
              </div>
            </div>
            
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-800 bg-clip-text text-transparent leading-tight">
              Sua Jornada de Investimento em Ações é Melhor Aqui
            </h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed">
              Imposta de Renda de Ações nunca foi tão <strong className="text-emerald-600">fácil</strong>. Você vai ver!.
            </p>
          </div>

          {/* Seção de confiança */}
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl p-6 border border-blue-200">
            <div className="flex items-center justify-center gap-4 mb-4">
              <Sparkles className="h-6 w-6 text-purple-600" />
              <h3 className="text-lg font-bold text-gray-800">Feito para Iniciantes</h3>
              <Sparkles className="h-6 w-6 text-blue-600" />
            </div>
            <p className="text-center text-gray-600 leading-relaxed">
              Interface intuitiva, explicações claras e suporte educativo para você aprender investindo com segurança
            </p>
          </div>

          {/* Features melhoradas */}
          <div className="grid gap-6 max-w-2xl mx-auto">
            <div className="group flex items-center space-x-6 p-6 bg-white/70 backdrop-blur-sm rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-500 hover:scale-105 border border-white/50">
              <div className="relative">
                <div className="p-4 bg-gradient-to-br from-emerald-500 to-green-600 rounded-2xl shadow-lg group-hover:rotate-12 transition-transform duration-500">
                  <TrendingUp className="h-8 w-8 text-white" />
                </div>
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-400 rounded-full animate-ping"></div>
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-gray-900 mb-2 flex items-center gap-2">
                  <span>📈</span>
                  <span>Acompanhamento Inteligente</span>
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  Monitore sua carteira em tempo real com gráficos intuitivos e insights educativos para <strong>iniciantes</strong>
                </p>
              </div>
            </div>

            <div className="group flex items-center space-x-6 p-6 bg-white/70 backdrop-blur-sm rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-500 hover:scale-105 border border-white/50">
              <div className="relative">
                <div className="p-4 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl shadow-lg group-hover:rotate-12 transition-transform duration-500">
                  <BarChart3 className="h-8 w-8 text-white" />
                </div>
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-400 rounded-full animate-pulse"></div>
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-gray-900 mb-2 flex items-center gap-2">
                  <span>🤖</span>
                  <span>Cálculo Automático de IR</span>
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  Nunca mais se preocupe com impostos! Calculamos automaticamente <strong>swing trade</strong> e <strong>day trade</strong> para você
                </p>
              </div>
            </div>

            <div className="group flex items-center space-x-6 p-6 bg-white/70 backdrop-blur-sm rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-500 hover:scale-105 border border-white/50">
              <div className="relative">
                <div className="p-4 bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl shadow-lg group-hover:rotate-12 transition-transform duration-500">
                  <PieChart className="h-8 w-8 text-white" />
                </div>
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-blue-400 rounded-full animate-bounce"></div>
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-gray-900 mb-2 flex items-center gap-2">
                  <span>🎯</span>
                  <span>Impostômetro Visual</span>
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  Visualize seu limite de isenção de <strong className="text-green-600">R$ 20.000</strong> e planeje suas operações com segurança
                </p>
              </div>
            </div>

            <div className="group flex items-center space-x-6 p-6 bg-white/70 backdrop-blur-sm rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-500 hover:scale-105 border border-white/50">
              <div className="relative">
                <div className="p-4 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl shadow-lg group-hover:rotate-12 transition-transform duration-500">
                  <Shield className="h-8 w-8 text-white" />
                </div>
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-400 rounded-full animate-pulse"></div>
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-gray-900 mb-2 flex items-center gap-2">
                  <span>🛡️</span>
                  <span>Segurança Total</span>
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  Seus dados protegidos com <strong>criptografia avançada</strong> e backup automático na nuvem
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Formulário de login modernizado */}
        <div className="w-full max-w-md mx-auto">
          <Card className="bg-white/80 backdrop-blur-sm shadow-2xl border-0 rounded-3xl overflow-hidden">
            <CardHeader className="text-center p-8 bg-gradient-to-r from-blue-500 to-purple-600 text-white">
              <div className="flex items-center justify-center mb-4">
                <div className="h-16 w-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                  <User className="h-8 w-8 text-white" />
                </div>
              </div>
              <CardTitle className="text-2xl font-bold mb-2">Bem-vindo de volta!</CardTitle>
              <CardDescription className="text-blue-100">
                Acesse sua carteira e continue sua jornada de investimento
              </CardDescription>
            </CardHeader>
            
            <CardContent className="p-8">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-3">
                  <Label htmlFor="username" className="text-gray-700 font-medium flex items-center gap-2">
                    <User className="h-4 w-4 text-gray-500" />
                    Usuário ou Email
                  </Label>
                  <div className="relative">
                    <Input
                      id="username"
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Digite seu usuário ou email"
                      required
                      className="h-12 px-4 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-200 transition-all duration-300 pl-12"
                    />
                    <User className="absolute left-4 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  </div>
                </div>

                <div className="space-y-3">
                  <Label htmlFor="password" className="text-gray-700 font-medium flex items-center gap-2">
                    <Lock className="h-4 w-4 text-gray-500" />
                    Senha
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Digite sua senha"
                      required
                      className="h-12 px-4 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-200 transition-all duration-300 pl-12 pr-12"
                    />
                    <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <Alert variant="destructive" className="border-red-200 bg-red-50">
                    <AlertDescription className="text-red-700">{error}</AlertDescription>
                  </Alert>
                )}

                <Button 
                  type="submit" 
                  className="w-full h-12 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105" 
                  disabled={loading}
                >
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      Entrando...
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span>🚀</span>
                      Entrar na Plataforma
                    </div>
                  )}
                </Button>
              </form>

              {/* Credenciais demo com design melhorado */}
              <div className="mt-8 bg-gradient-to-r from-emerald-50 to-blue-50 rounded-2xl p-6 border border-emerald-200">
                <div className="flex items-center justify-center gap-2 mb-3">
                  <span className="text-2xl">🎮</span>
                  <h3 className="text-sm font-bold text-gray-800">Experimente Agora</h3>
                </div>
                <div className="space-y-2 text-center">
                  <p className="text-sm text-gray-600">
                    <strong className="text-emerald-600">Usuário:</strong> <code className="bg-emerald-100 px-2 py-1 rounded text-emerald-800">admin</code>
                  </p>
                  <p className="text-sm text-gray-600">
                    <strong className="text-blue-600">Senha:</strong> <code className="bg-blue-100 px-2 py-1 rounded text-blue-800">admin123</code>
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    Use essas credenciais para testar a plataforma
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Seção de segurança mobile */}
          <div className="lg:hidden mt-6 bg-white/70 backdrop-blur-sm rounded-2xl p-4 border border-white/50">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Shield className="h-5 w-5 text-green-600" />
              <p className="text-sm font-medium text-gray-800">100% Seguro</p>
            </div>
            <p className="text-xs text-gray-600 text-center">
              Seus dados são protegidos com criptografia de nível bancário
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}