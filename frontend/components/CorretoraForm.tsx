"use client";

import React, { useState, useEffect } from 'react';
import { Corretora, CorretoraCreate } from '@/lib/types'; // Assuming types are in @/lib/types
import { Button } from '@/components/ui/button'; // Assuming shadcn/ui button
import { Input } from '@/components/ui/input';   // Assuming shadcn/ui input
import { Label } from '@/components/ui/label';   // Assuming shadcn/ui label
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'; // Assuming shadcn/ui card

interface CorretoraFormProps {
  onSubmit: (data: CorretoraCreate) => Promise<void>; // Made async to handle API calls
  initialData?: Corretora | null;
  onCancel?: () => void; // Optional: To close a modal or navigate away
}

const CorretoraForm: React.FC<CorretoraFormProps> = ({ onSubmit, initialData, onCancel }) => {
  const [nome, setNome] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (initialData) {
      setNome(initialData.nome);
      setCnpj(initialData.cnpj || '');
    } else {
      setNome('');
      setCnpj('');
    }
  }, [initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    if (!nome.trim()) {
      setError('O nome da corretora é obrigatório.');
      setIsLoading(false);
      return;
    }

    // Basic CNPJ validation (optional, can be enhanced)
    // This is a very simple validation, a proper one would check digits, format, etc.
    if (cnpj.trim() && !/^\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}$/.test(cnpj.trim()) && !/^\d{14}$/.test(cnpj.trim())) {
      setError('CNPJ inválido. Formato esperado: XX.XXX.XXX/XXXX-XX ou XXXXXXXXXXXXXX.');
      setIsLoading(false);
      return;
    }

    // Remove formatting from CNPJ if present, before sending
    const cleanedCnpj = cnpj.replace(/[^\d]/g, '');

    try {
      await onSubmit({ nome: nome.trim(), cnpj: cleanedCnpj || undefined }); // Send undefined if empty
      // Form will be reset by parent component controlling initialData or by onCancel
    } catch (apiError: any) {
      setError(apiError.message || 'Erro ao salvar corretora.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle>{initialData ? 'Editar Corretora' : 'Adicionar Nova Corretora'}</CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent>
          {error && <p className="text-red-500 mb-4">{error}</p>}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nome-corretora">Nome da Corretora</Label>
              <Input
                id="nome-corretora"
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: XP Investimentos"
                required
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cnpj-corretora">CNPJ (Opcional)</Label>
              <Input
                id="cnpj-corretora"
                type="text"
                value={cnpj}
                onChange={(e) => setCnpj(e.target.value)}
                placeholder="XX.XXX.XXX/XXXX-XX"
                disabled={isLoading}
              />
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end space-x-2">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
              Cancelar
            </Button>
          )}
          <Button type="submit" disabled={isLoading}>
            {isLoading ? (initialData ? 'Salvando...' : 'Adicionando...') : (initialData ? 'Salvar Alterações' : 'Adicionar Corretora')}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
};

export default CorretoraForm;
