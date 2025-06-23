import React from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { LucideProps } from 'lucide-react';

interface InfoCardProps {
  title: string;
  value: string | number | React.ReactNode;
  description?: string;
  icon?: React.ComponentType<LucideProps>; // Aceita ícones do lucide-react
}

export function InfoCard({ title, value, description, icon: Icon }: InfoCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}
