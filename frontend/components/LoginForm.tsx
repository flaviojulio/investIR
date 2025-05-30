"use client"

import type React from "react"

import { useState } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { TrendingUp, BarChart3, PieChart } from "lucide-react"

export function LoginForm() {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
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
      // Assuming you might also want to use toast here, though not explicitly in original code
      // toast({ title: "Erro no Login", description: displayErrorMessage, variant: "destructive" });
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-6xl grid lg:grid-cols-2 gap-8 items-center">
        {/* Seção de apresentação */}
        <div className="hidden lg:block space-y-8">
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-bold text-gray-900">Gerenciador de Carteira de Ações</h1>
            <p className="text-xl text-gray-600">
              Controle completo da sua carteira com cálculo automático de impostos
            </p>
          </div>

          <div className="grid gap-6">
            <div className="flex items-center space-x-4 p-4 bg-white rounded-lg shadow-sm">
              <div className="p-3 bg-blue-100 rounded-full">
                <TrendingUp className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Acompanhamento em Tempo Real</h3>
                <p className="text-gray-600">Monitore sua carteira e performance</p>
              </div>
            </div>

            <div className="flex items-center space-x-4 p-4 bg-white rounded-lg shadow-sm">
              <div className="p-3 bg-green-100 rounded-full">
                <BarChart3 className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Cálculo Automático de IR</h3>
                <p className="text-gray-600">Swing trade e day trade calculados automaticamente</p>
              </div>
            </div>

            <div className="flex items-center space-x-4 p-4 bg-white rounded-lg shadow-sm">
              <div className="p-3 bg-purple-100 rounded-full">
                <PieChart className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Impostômetro</h3>
                <p className="text-gray-600">Acompanhe o limite de isenção de R$ 20.000</p>
              </div>
            </div>
          </div>
        </div>

        {/* Formulário de login */}
        <Card className="w-full max-w-md mx-auto">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Entrar na Plataforma</CardTitle>
            <CardDescription>Digite suas credenciais para acessar sua carteira</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Usuário ou Email</Label>
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Digite seu usuário ou email"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Digite sua senha"
                  required
                />
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Entrando..." : "Entrar"}
              </Button>
            </form>

            <div className="mt-4 text-center text-sm text-gray-600">
              <p>
                Usuário demo: <strong>admin</strong>
              </p>
              <p>
                Senha demo: <strong>admin123</strong>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
