"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Corretora, CorretoraCreate } from '@/lib/types';
import { fetchCorretoras, createCorretora, updateCorretora, deleteCorretora } from '@/lib/api';
import CorretoraTable from './CorretoraTable';
import CorretoraForm from './CorretoraForm';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog'; // Assuming shadcn/ui dialog
import { PlusCircle } from 'lucide-react';

const ManageCorretoras: React.FC = () => {
  const [corretoras, setCorretoras] = useState<Corretora[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCorretora, setEditingCorretora] = useState<Corretora | null>(null);

  const loadCorretoras = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchCorretoras();
      setCorretoras(data);
    } catch (err: any) {
      setError(err.message || 'Falha ao carregar corretoras.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCorretoras();
  }, [loadCorretoras]);

  const handleFormSubmit = async (data: CorretoraCreate) => {
    setError(null); // Clear previous errors
    try {
      if (editingCorretora) {
        await updateCorretora(editingCorretora.id, data);
        // alert('Corretora atualizada com sucesso!'); // Replace with a toast notification
      } else {
        await createCorretora(data);
        // alert('Corretora criada com sucesso!'); // Replace with a toast notification
      }
      setIsModalOpen(false);
      setEditingCorretora(null);
      await loadCorretoras(); // Recarrega a lista
    } catch (err: any) {
      // The CorretoraForm itself will display specific field errors if needed,
      // this catch is for general errors from the API call not caught by the form.
      console.error("Erro ao salvar corretora (ManageCorretoras):", err.message);
      setError(err.message || 'Erro ao salvar corretora. Verifique os campos ou tente novamente.');
      // Do not close modal on error, so user can see form errors or try again
      // setIsModalOpen(false);
      throw err; // Re-throw to let CorretoraForm handle it if it has its own error display
    }
  };

  const handleEdit = (corretora: Corretora) => {
    setEditingCorretora(corretora);
    setError(null); // Clear main page errors when opening modal
    setIsModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    setError(null);
    try {
      await deleteCorretora(id);
      // alert('Corretora excluída com sucesso!'); // Replace with a toast notification
      await loadCorretoras(); // Recarrega a lista
    } catch (err: any) {
      console.error("Erro ao excluir corretora (ManageCorretoras):", err.message);
      setError(err.message || 'Falha ao excluir corretora.');
      // Display error to user, e.g., using a toast notification system
      alert(`Erro ao excluir: ${err.message}`);
    }
  };

  const openModalForCreate = () => {
    setEditingCorretora(null);
    setError(null);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">Gerenciar Corretoras</h1>
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogTrigger asChild>
            <Button onClick={openModalForCreate}>
              <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Corretora
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>{editingCorretora ? 'Editar Corretora' : 'Adicionar Nova Corretora'}</DialogTitle>
            </DialogHeader>
            {/*
              The CorretoraForm will now throw an error if its onSubmit fails.
              This error will be caught by the try/catch in handleFormSubmit.
              The form's internal error state will show field-specific issues.
              The setError here in ManageCorretoras is for errors that occur
              after successful form validation but during the API call itself,
              or for feedback about the overall process.
            */}
            <CorretoraForm
              onSubmit={handleFormSubmit}
              initialData={editingCorretora}
              onCancel={() => {
                setIsModalOpen(false);
                setEditingCorretora(null);
                setError(null); // Clear any errors when cancelling
              }}
            />
            {/*
              Error display within the modal could be beneficial too,
              if CorretoraForm doesn't handle all API error feedback.
              For now, CorretoraForm has its own error display.
            */}
          </DialogContent>
        </Dialog>
      </div>

      {isLoading && <p>Carregando corretoras...</p>}
      {error && !isModalOpen && <p className="text-red-500 py-4">Erro: {error}</p>}
      {/* Display general errors here only if modal is closed, as modal has its own error display */}

      {!isLoading && !error && (
        <CorretoraTable
          corretoras={corretoras}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
};

export default ManageCorretoras;
