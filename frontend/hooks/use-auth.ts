"use client"

import type React from "react"
import { createContext, useContext, useEffect, useState } from "react"
// Update the path below to the correct location of your api file, for example:
import { authAPI, AuthManager, type User, handleAPIError } from "../lib/api"
// or, if your api file is in a different directory, adjust accordingly:
// import { authAPI, AuthManager, type User, handleAPIError } from "../../lib/api"
// import { authAPI, AuthManager, type User, handleAPIError } from "./api"
import { useRouter } from "next/navigation"
// Update the path below if your use-toast file is located elsewhere, e.g.:
import { toast } from "../hooks/use-toast"
// or, if it's in the same directory:
// import { toast } from "./use-toast"
// or, if it should be in 'lib':
// import { toast } from "@/lib/use-toast"

interface AuthContextType {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  register: (userData: {
    username: string
    email: string
    senha: string
    nome_completo?: string
  }) => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  login: async () => {},
  logout: async () => {},
  register: async () => {},
})

interface AuthProviderProps {
  children: React.ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  const isAuthenticated = Boolean(user)

  useEffect(() => {
    const initAuth = async () => {
      try {
        if (AuthManager.isAuthenticated()) {
          const userData = await authAPI.getMe()
          setUser(userData)
        }
      } catch (error) {
        AuthManager.removeToken()
        // Não chame handleAPIError aqui para evitar loop se o erro for no getMe
        // e o usuário já estiver sendo redirecionado ou o token removido.
        // Apenas logar o erro pode ser suficiente ou deixar o AuthGuard lidar com isso.
        console.error("Erro durante initAuth:", error)
      } finally {
        setIsLoading(false)
      }
    }
    initAuth()
  }, [])

  const login = async (username: string, password: string) => {
    try {
      setIsLoading(true)
      const response = await authAPI.login(username, password)
      AuthManager.setToken(response.access_token)
      const userData = await authAPI.getMe()
      setUser(userData)
      toast({
        title: "Login realizado",
        description: `Bem-vindo, ${userData.nome_completo || userData.username}!`,
      })
      router.push("/")
    } catch (error) {
      handleAPIError(error) // Aqui é apropriado, pois é uma ação direta do usuário
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  const logout = async () => {
    try {
      // Tentar o logout da API primeiro, mas não bloquear se falhar
      await authAPI.logout().catch(error => console.error("Erro na API de logout:", error))
    } finally {
      AuthManager.removeToken()
      setUser(null)
      router.push("/login")
      toast({
        title: "Logout realizado",
        description: "Você foi desconectado com sucesso.",
      })
    }
  }

  const register = async (userData: {
    username: string
    email: string
    senha: string
    nome_completo?: string
  }) => {
    try {
      setIsLoading(true)
      await authAPI.register(userData)
      toast({
        title: "Conta criada",
        description: "Sua conta foi criada com sucesso. Faça login para continuar.",
      })
      router.push("/login")
    } catch (error) {
      handleAPIError(error)
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  const contextValue: AuthContextType = {
    user,
    isLoading,
    isAuthenticated,
    login,
    logout,
    register,
  }

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)
  if (context === undefined) {
    console.error("useAuth foi chamado fora do AuthProvider")
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
