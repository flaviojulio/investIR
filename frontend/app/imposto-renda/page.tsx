"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function ImpostoRendaPage() {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">
        Declaração Anual de Imposto de Renda
      </h1>
      <Tabs defaultValue="bens-e-direitos">
        <TabsList>
          <TabsTrigger value="bens-e-direitos">Bens e Direitos</TabsTrigger>
          <TabsTrigger value="rendimentos-isentos">
            Rendimentos Isentos e Não tributáveis
          </TabsTrigger>
          <TabsTrigger value="rendimentos-tributacao-exclusiva">
            Rendimentos Sujeitos a Tributação Exclusiva
          </TabsTrigger>
          <TabsTrigger value="renda-variavel">Renda Variável</TabsTrigger>
        </TabsList>
        <TabsContent value="bens-e-direitos">
          <p>Conteúdo da aba Bens e Direitos.</p>
        </TabsContent>
        <TabsContent value="rendimentos-isentos">
          <p>Conteúdo da aba Rendimentos Isentos e Não tributáveis.</p>
        </TabsContent>
        <TabsContent value="rendimentos-tributacao-exclusiva">
          <p>
            Conteúdo da aba Rendimentos Sujeitos a Tributação Exclusiva.
          </p>
        </TabsContent>
        <TabsContent value="renda-variavel">
          <p>Conteúdo da aba Renda Variável.</p>
        </TabsContent>
      </Tabs>
    </div>
  );
}
