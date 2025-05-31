import React from 'react';

interface AppSidebarProps {
  setActiveView: (view: string) => void;
  activeView: string;
}

const navItems = [
  { name: 'Visão Geral', view: 'Visão Geral' },
  { name: 'Registrar Operação', view: 'Operações' }, // "Operações" changed to "Registrar Operação"
  { name: 'Importar Nota', view: 'Upload de Nota' }, // "Upload de Nota" changed to "Importar Nota"
  { name: 'Impostos', view: 'Impostos' },
  { name: 'Histórico de Operações', view: 'Histórico de Operações' },
];

const AppSidebar: React.FC<AppSidebarProps> = ({ setActiveView, activeView }) => {
  return (
    <div className="w-[200px] border-r border-gray-border p-4 bg-sidebar-bg text-sidebar-text h-screen"> {/* p-5 to p-4 */}
      <nav>
        <ul>
          {navItems.map((item) => (
            <li
              key={item.name}
              onClick={() => setActiveView(item.view)}
              className={`
                cursor-pointer mb-1 py-1.5 px-3 rounded-md {/* mb-2 to mb-1, py-2 to py-1.5 */}
                hover:bg-sidebar-active-bg hover:text-white
                ${activeView === item.view ? 'bg-sidebar-active-bg text-white' : ''}
              `}
            >
              {item.name}
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
};

export default AppSidebar;
