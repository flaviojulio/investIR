"use client"

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/hooks/use-toast'
import { 
  User, 
  Settings, 
  Bell, 
  Eye, 
  Palette, 
  Globe, 
  DollarSign,
  Calendar,
  Save,
  RefreshCw,
  ArrowLeft
} from 'lucide-react'
import { api } from '@/lib/api'
import { ConfiguracaoUsuario, ConfiguracaoUsuarioUpdate, PerfilUsuario } from '@/lib/types'
import { useRouter } from 'next/navigation'
import { formatarCPFInput, validarCPF, limparCPF } from '@/lib/cpf-utils'

export default function ProfileSettings() {
  const [perfil, setPerfil] = useState<PerfilUsuario | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [configuracoes, setConfiguracoes] = useState<ConfiguracaoUsuarioUpdate>({})
  const [dadosUsuario, setDadosUsuario] = useState<{
    nome_completo: string;
    cpf: string;
  }>({
    nome_completo: '',
    cpf: ''
  })
  const [cpfError, setCpfError] = useState('')
  const { toast } = useToast()
  const router = useRouter()

  useEffect(() => {
    carregarPerfil()
  }, [])

  const carregarPerfil = async () => {
    try {
      setLoading(true)
      const response = await api.get('/usuario/perfil')
      setPerfil(response.data)
      setConfiguracoes(response.data.configuracoes)
      
      // Carregar dados do usuário para edição
      setDadosUsuario({
        nome_completo: response.data.usuario.nome_completo || '',
        cpf: response.data.usuario.cpf || ''
      })
    } catch (error) {
      console.error('Erro ao carregar perfil:', error)
      toast({
        title: "Erro",
        description: "Erro ao carregar configurações do perfil",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const salvarConfiguracoes = async () => {
    try {
      setSaving(true)
      const response = await api.put('/usuario/configuracoes', configuracoes)
      
      // Atualizar o perfil local com os novos dados
      if (perfil) {
        setPerfil({
          ...perfil,
          configuracoes: response.data
        })
      }
      
      toast({
        title: "Sucesso",
        description: "Configurações salvas com sucesso!",
        variant: "default"
      })
    } catch (error) {
      console.error('Erro ao salvar configurações:', error)
      toast({
        title: "Erro",
        description: "Erro ao salvar configurações",
        variant: "destructive"
      })
    } finally {
      setSaving(false)
    }
  }

  const salvarDadosUsuario = async () => {
    try {
      // Validar CPF se preenchido
      if (dadosUsuario.cpf && !validarCPF(dadosUsuario.cpf)) {
        setCpfError('CPF inválido')
        return
      }
      
      setCpfError('')
      setSaving(true)
      
      const dadosParaEnvio = {
        nome_completo: dadosUsuario.nome_completo,
        cpf: dadosUsuario.cpf ? limparCPF(dadosUsuario.cpf) : null
      }
      
      const response = await api.put('/usuario/dados', dadosParaEnvio)
      
      // Atualizar perfil local
      if (perfil) {
        setPerfil({
          ...perfil,
          usuario: {
            ...perfil.usuario,
            nome_completo: response.data.nome_completo,
            cpf: response.data.cpf
          }
        })
      }
      
      toast({
        title: "Sucesso",
        description: "Dados pessoais salvos com sucesso!",
        variant: "default"
      })
    } catch (error) {
      console.error('Erro ao salvar dados do usuário:', error)
      toast({
        title: "Erro",
        description: "Erro ao salvar dados pessoais",
        variant: "destructive"
      })
    } finally {
      setSaving(false)
    }
  }

  const atualizarConfiguracao = (campo: keyof ConfiguracaoUsuarioUpdate, valor: any) => {
    setConfiguracoes(prev => ({
      ...prev,
      [campo]: valor
    }))
  }

  const atualizarDashboard = (campo: string, valor: any) => {
    setConfiguracoes(prev => ({
      ...prev,
      configuracoes_dashboard: {
        ...prev.configuracoes_dashboard,
        [campo]: valor
      }
    }))
  }

  const handleCPFChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const valor = e.target.value
    const cpfFormatado = formatarCPFInput(valor)
    
    setDadosUsuario(prev => ({
      ...prev,
      cpf: cpfFormatado
    }))
    
    // Limpar erro se CPF válido
    if (validarCPF(cpfFormatado)) {
      setCpfError('')
    }
  }

  const handleNomeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDadosUsuario(prev => ({
      ...prev,
      nome_completo: e.target.value
    }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  if (!perfil) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">Erro ao carregar perfil do usuário</p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="space-y-4">
        {/* Botão Voltar */}
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={() => router.push('/')}
            className="flex items-center gap-2 hover:bg-indigo-50 hover:border-indigo-300"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar ao Dashboard
          </Button>
        </div>

        {/* Título */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            Configurações do Perfil
          </h1>
          <p className="text-gray-600">Personalize sua experiência no investIR</p>
        </div>
      </div>

      <Tabs defaultValue="pessoal" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="pessoal" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Pessoal
          </TabsTrigger>
          <TabsTrigger value="interface" className="flex items-center gap-2">
            <Palette className="h-4 w-4" />
            Interface
          </TabsTrigger>
          <TabsTrigger value="notificacoes" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Notificações
          </TabsTrigger>
          <TabsTrigger value="dashboard" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Dashboard
          </TabsTrigger>
        </TabsList>

        {/* Tab Pessoal */}
        <TabsContent value="pessoal" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Informações Pessoais
              </CardTitle>
              <CardDescription>
                Gerencie suas informações básicas de perfil
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="username">Nome de usuário</Label>
                  <Input
                    id="username"
                    value={perfil.usuario.username}
                    disabled
                    className="bg-gray-50"
                  />
                  <p className="text-sm text-gray-500">Nome de usuário não pode ser alterado</p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    value={perfil.usuario.email}
                    disabled
                    className="bg-gray-50"
                  />
                  <p className="text-sm text-gray-500">E-mail não pode ser alterado</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="nome_completo">Nome completo</Label>
                <Input
                  id="nome_completo"
                  placeholder="Seu nome completo"
                  value={dadosUsuario.nome_completo}
                  onChange={handleNomeChange}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cpf">CPF</Label>
                <Input
                  id="cpf"
                  placeholder="000.000.000-00"
                  value={dadosUsuario.cpf}
                  onChange={handleCPFChange}
                  maxLength={14}
                  className={cpfError ? 'border-red-500' : ''}
                />
                {cpfError && (
                  <p className="text-sm text-red-500">{cpfError}</p>
                )}
                <p className="text-sm text-gray-500">
                  Formato: 000.000.000-00 (apenas números brasileiros válidos)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="nome_exibicao">Nome de exibição</Label>
                <Input
                  id="nome_exibicao"
                  placeholder="Como você gostaria de ser chamado?"
                  value={configuracoes.nome_exibicao || ''}
                  onChange={(e) => atualizarConfiguracao('nome_exibicao', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="avatar_url">URL do Avatar</Label>
                <Input
                  id="avatar_url"
                  placeholder="https://exemplo.com/avatar.jpg"
                  value={configuracoes.avatar_url || ''}
                  onChange={(e) => atualizarConfiguracao('avatar_url', e.target.value)}
                />
              </div>

              {/* Botão para salvar dados pessoais */}
              <div className="pt-4 border-t border-gray-200">
                <Button
                  onClick={salvarDadosUsuario}
                  disabled={saving}
                  className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                >
                  <Save className={`h-4 w-4 ${saving ? 'animate-pulse' : ''}`} />
                  {saving ? 'Salvando...' : 'Salvar Dados Pessoais'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Interface */}
        <TabsContent value="interface" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Aparência e Localização
              </CardTitle>
              <CardDescription>
                Personalize como o sistema é exibido para você
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Palette className="h-4 w-4" />
                    Tema
                  </Label>
                  <Select
                    value={configuracoes.tema || 'light'}
                    onValueChange={(value) => atualizarConfiguracao('tema', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">Claro</SelectItem>
                      <SelectItem value="dark">Escuro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    Idioma
                  </Label>
                  <Select
                    value={configuracoes.idioma || 'pt-br'}
                    onValueChange={(value) => atualizarConfiguracao('idioma', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pt-br">Português (Brasil)</SelectItem>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="es">Español</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Moeda Preferida
                  </Label>
                  <Select
                    value={configuracoes.moeda_preferida || 'BRL'}
                    onValueChange={(value) => atualizarConfiguracao('moeda_preferida', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BRL">Real (R$)</SelectItem>
                      <SelectItem value="USD">Dólar ($)</SelectItem>
                      <SelectItem value="EUR">Euro (€)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Formato de Data
                  </Label>
                  <Select
                    value={configuracoes.formato_data || 'dd/mm/yyyy'}
                    onValueChange={(value) => atualizarConfiguracao('formato_data', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dd/mm/yyyy">DD/MM/AAAA</SelectItem>
                      <SelectItem value="mm/dd/yyyy">MM/DD/AAAA</SelectItem>
                      <SelectItem value="yyyy-mm-dd">AAAA-MM-DD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Precisão Decimal (casas decimais)</Label>
                <Select
                  value={String(configuracoes.precisao_decimal || 2)}
                  onValueChange={(value) => atualizarConfiguracao('precisao_decimal', parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">0 casas (R$ 100)</SelectItem>
                    <SelectItem value="2">2 casas (R$ 100,00)</SelectItem>
                    <SelectItem value="4">4 casas (R$ 100,0000)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="space-y-1">
                  <Label className="flex items-center gap-2">
                    <Eye className="h-4 w-4" />
                    Exibir valores totais
                  </Label>
                  <p className="text-sm text-gray-600">
                    Mostrar valores consolidados na interface
                  </p>
                </div>
                <Switch
                  checked={configuracoes.exibir_valores_totais ?? true}
                  onCheckedChange={(checked) => atualizarConfiguracao('exibir_valores_totais', checked)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Notificações */}
        <TabsContent value="notificacoes" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Preferências de Notificação
              </CardTitle>
              <CardDescription>
                Configure como você deseja receber notificações
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="space-y-1">
                  <Label>Notificações por E-mail</Label>
                  <p className="text-sm text-gray-600">
                    Receber alertas e atualizações importantes por e-mail
                  </p>
                </div>
                <Switch
                  checked={configuracoes.notificacoes_email ?? true}
                  onCheckedChange={(checked) => atualizarConfiguracao('notificacoes_email', checked)}
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="space-y-1">
                  <Label>Notificações Push</Label>
                  <p className="text-sm text-gray-600">
                    Receber notificações instantâneas no navegador
                  </p>
                </div>
                <Switch
                  checked={configuracoes.notificacoes_push ?? true}
                  onCheckedChange={(checked) => atualizarConfiguracao('notificacoes_push', checked)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Dashboard */}
        <TabsContent value="dashboard" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Configurações do Dashboard
              </CardTitle>
              <CardDescription>
                Personalize a disposição e comportamento do dashboard
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Modo de Visualização</Label>
                <Select
                  value={configuracoes.configuracoes_dashboard?.modo_visualizacao || 'cards'}
                  onValueChange={(value) => atualizarDashboard('modo_visualizacao', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cards">Cards</SelectItem>
                    <SelectItem value="compact">Compacto</SelectItem>
                    <SelectItem value="detailed">Detalhado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label>Widgets Visíveis no Dashboard</Label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { id: 'carteira', label: 'Carteira Atual' },
                    { id: 'resultados', label: 'Resultados Mensais' },
                    { id: 'operacoes_recentes', label: 'Operações Recentes' },
                    { id: 'darfs', label: 'DARFs Pendentes' }
                  ].map((widget) => (
                    <div key={widget.id} className="flex items-center space-x-2 p-2 bg-gray-50 rounded">
                      <input
                        type="checkbox"
                        id={widget.id}
                        checked={configuracoes.configuracoes_dashboard?.widgets_visiveis?.includes(widget.id) ?? true}
                        onChange={(e) => {
                          const widgets = configuracoes.configuracoes_dashboard?.widgets_visiveis || []
                          if (e.target.checked) {
                            atualizarDashboard('widgets_visiveis', [...widgets, widget.id])
                          } else {
                            atualizarDashboard('widgets_visiveis', widgets.filter(w => w !== widget.id))
                          }
                        }}
                        className="rounded"
                      />
                      <Label htmlFor={widget.id} className="text-sm font-normal">
                        {widget.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Botões de Ação */}
      <div className="flex justify-between items-center pt-6 border-t">
        <Button
          variant="outline"
          onClick={carregarPerfil}
          disabled={loading}
          className="flex items-center gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Recarregar
        </Button>

        <Button
          onClick={salvarConfiguracoes}
          disabled={saving}
          className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
        >
          <Save className={`h-4 w-4 ${saving ? 'animate-pulse' : ''}`} />
          {saving ? 'Salvando...' : 'Salvar Configurações'}
        </Button>
      </div>
    </div>
  )
}