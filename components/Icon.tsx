import React from "react";
import {
  Search,
  Settings,
  Home,
  Bell,
  Plus,
  Compass,
  User,
  Heart,
  MessageCircle,
  Check,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Bookmark,
  BookmarkX,
  Pencil,
  Trash2,
  Maximize2,
  Minimize2,
  RefreshCw,
  type LucideProps,
} from "lucide-react";

type Props = { name: string; className?: string; size?: number; strokeWidth?: number };

const ICON_MAP: Record<string, React.ComponentType<LucideProps>> = {
  search: Search,
  settings: Settings,
  home: Home,
  bell: Bell,
  plus: Plus,
  discover: Compass,
  user: User,
  heart: Heart,
  comment: MessageCircle,
  check: Check,
  "chev-left": ChevronLeft,
  "chev-right": ChevronRight,
  calendar: Calendar,
  pin: Bookmark,
  unpin: BookmarkX,
  edit: Pencil,
  trash: Trash2,
  maximize: Maximize2,
  minimize: Minimize2,
  refresh: RefreshCw,
};

export default function Icon({ name, className, size = 18, strokeWidth = 1.75 }: Props) {
  const Component = ICON_MAP[name];
  if (!Component) return null;
  return <Component size={size} className={className} strokeWidth={strokeWidth} />;
}
