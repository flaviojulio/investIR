"use client";
import React from 'react';

export default function ConfiguracoesPage() {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Configurações</h1>
      <div className="space-y-4">
        <p className="text-muted-foreground">
          Ajuste as configurações e preferências do sistema.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Card para Corretoras */}
          <a href="/configuracoes/corretoras" className="block p-6 bg-card border rounded-lg shadow hover:bg-muted/50 transition-colors">
            <h2 className="text-xl font-semibold mb-2">Gerenciar Corretoras</h2>
            <p className="text-sm text-muted-foreground">
              Adicione, edite ou remova as corretoras utilizadas em suas operações.
            </p>
          </a>

          {/* Adicionar outros cards de configuração aqui conforme necessário */}
          {/* Exemplo:
          <a href="/configuracoes/perfil" className="block p-6 bg-card border rounded-lg shadow hover:bg-muted/50 transition-colors">
            <h2 className="text-xl font-semibold mb-2">Meu Perfil</h2>
            <p className="text-sm text-muted-foreground">
              Atualize suas informações pessoais e preferências de conta.
            </p>
          </a>
          */}
        </div>
      </div>
    </div>
  );
}
