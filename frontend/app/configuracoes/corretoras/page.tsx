import React from 'react';
import ManageCorretoras from '@/components/ManageCorretoras'; // Adjust path if necessary
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Optional: Add metadata for the page
// export const metadata = {
//   title: 'Gerenciar Corretoras - Finanças Pessoais',
//   description: 'Adicione, edite ou remova suas corretoras de investimento.',
// };

const CorretorasPage = () => {
  return (
    <div className="container mx-auto py-10">
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl font-bold tracking-tight">
            Configurações - Minhas Corretoras
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-6">
            Gerencie as corretoras que você utiliza para suas operações de investimento.
          </p>
          <ManageCorretoras />
        </CardContent>
      </Card>
    </div>
  );
};

export default CorretorasPage;
