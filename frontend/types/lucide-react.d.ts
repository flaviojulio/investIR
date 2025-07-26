declare module 'lucide-react' {
  import { ComponentType, SVGProps } from 'react';
  
  interface IconProps extends SVGProps<SVGSVGElement> {
    size?: string | number;
    color?: string;
    strokeWidth?: string | number;
  }
  
  export interface LucideProps extends IconProps {}

  // All icons used throughout the application
  export const Activity: ComponentType<IconProps>;
  export const AlertCircle: ComponentType<IconProps>;
  export const AlertTriangle: ComponentType<IconProps>;
  export const ArrowDown: ComponentType<IconProps>;
  export const ArrowDownRight: ComponentType<IconProps>;
  export const ArrowLeft: ComponentType<IconProps>;
  export const ArrowRight: ComponentType<IconProps>;
  export const ArrowUp: ComponentType<IconProps>;
  export const ArrowUpDown: ComponentType<IconProps>;
  export const ArrowUpRight: ComponentType<IconProps>;
  export const BarChart3: ComponentType<IconProps>;
  export const BookOpen: ComponentType<IconProps>;
  export const Briefcase: ComponentType<IconProps>;
  export const Building: ComponentType<IconProps>;
  export const Building2: ComponentType<IconProps>;
  export const Calculator: ComponentType<IconProps>;
  export const Calendar: ComponentType<IconProps>;
  export const Check: ComponentType<IconProps>;
  export const CheckCheck: ComponentType<IconProps>;
  export const CheckCircle: ComponentType<IconProps>;
  export const CheckCircle2: ComponentType<IconProps>;
  export const ChevronDown: ComponentType<IconProps>;
  export const ChevronLeft: ComponentType<IconProps>;
  export const ChevronRight: ComponentType<IconProps>;
  export const ChevronUp: ComponentType<IconProps>;
  export const ChevronsUpDown: ComponentType<IconProps>;
  export const Circle: ComponentType<IconProps>;
  export const ClipboardCheck: ComponentType<IconProps>;
  export const Clock: ComponentType<IconProps>;
  export const Cloud: ComponentType<IconProps>;
  export const Coins: ComponentType<IconProps>;
  export const Crown: ComponentType<IconProps>;
  export const DollarSign: ComponentType<IconProps>;
  export const Dot: ComponentType<IconProps>;
  export const Download: ComponentType<IconProps>;
  export const Edit: ComponentType<IconProps>;
  export const Edit3: ComponentType<IconProps>;
  export const ExternalLink: ComponentType<IconProps>;
  export const Eye: ComponentType<IconProps>;
  export const EyeOff: ComponentType<IconProps>;
  export const FileText: ComponentType<IconProps>;
  export const FileX: ComponentType<IconProps>;
  export const Filter: ComponentType<IconProps>;
  export const Gift: ComponentType<IconProps>;
  export const GitBranch: ComponentType<IconProps>;
  export const GitMerge: ComponentType<IconProps>;
  export const GripVertical: ComponentType<IconProps>;
  export const Hash: ComponentType<IconProps>;
  export const HelpCircle: ComponentType<IconProps>;
  export const History: ComponentType<IconProps>;
  export const Info: ComponentType<IconProps>;
  export const Landmark: ComponentType<IconProps>;
  export const Lightbulb: ComponentType<IconProps>;
  export const Link: ComponentType<IconProps>;
  export const Loader2: ComponentType<IconProps>;
  export const Lock: ComponentType<IconProps>;
  export const LogOut: ComponentType<IconProps>;
  export const MoreHorizontal: ComponentType<IconProps>;
  export const MoreVertical: ComponentType<IconProps>;
  export const Package: ComponentType<IconProps>;
  export const PanelLeft: ComponentType<IconProps>;
  export const PieChart: ComponentType<IconProps>;
  export const PiggyBank: ComponentType<IconProps>;
  export const Plus: ComponentType<IconProps>;
  export const PlusCircle: ComponentType<IconProps>;
  export const Receipt: ComponentType<IconProps>;
  export const RotateCcw: ComponentType<IconProps>;
  export const Search: ComponentType<IconProps>;
  export const Shield: ComponentType<IconProps>;
  export const ShoppingCart: ComponentType<IconProps>;
  export const Sparkles: ComponentType<IconProps>;
  export const Target: ComponentType<IconProps>;
  export const Trash2: ComponentType<IconProps>;
  export const TrendingDown: ComponentType<IconProps>;
  export const TrendingUp: ComponentType<IconProps>;
  export const TrendingUpDown: ComponentType<IconProps>;
  export const Trophy: ComponentType<IconProps>;
  export const Upload: ComponentType<IconProps>;
  export const UploadCloud: ComponentType<IconProps>;
  export const User: ComponentType<IconProps>;
  export const Wallet: ComponentType<IconProps>;
  export const X: ComponentType<IconProps>;
  export const Zap: ComponentType<IconProps>;
}
