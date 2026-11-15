import {
  CalendarDays,
  ClipboardCheck,
  CreditCard,
  FileText,
  GraduationCap,
  Home,
  BookOpen,
  CalendarHeart,
  ChartNoAxesCombined,
  MessageCircleMore,
  Settings,
  UsersRound,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { PermissionModule } from '@/app/auth/permissions'

export type NavigationItem = {
  label: string
  path: string
  icon: LucideIcon
  module: PermissionModule
  tone?: 'pink' | 'yellow' | 'blue' | 'purple' | 'green' | 'peach'
}

export const navigationItems: NavigationItem[] = [
  { label: 'Painel', path: '/', icon: Home, module: 'dashboard' },
  { label: 'Agenda', path: '/agenda', icon: CalendarDays, module: 'agenda', tone: 'pink' },
  { label: 'Alunos', path: '/alunos', icon: GraduationCap, module: 'students', tone: 'yellow' },
  { label: 'Responsáveis', path: '/responsaveis', icon: UsersRound, module: 'guardians', tone: 'blue' },
  { label: 'Turmas', path: '/turmas', icon: BookOpen, module: 'classes', tone: 'purple' },
  { label: 'Frequência', path: '/frequencia', icon: ClipboardCheck, module: 'attendance', tone: 'green' },
  { label: 'Mensalidades', path: '/mensalidades', icon: CreditCard, module: 'billing', tone: 'peach' },
  { label: 'Financeiro', path: '/financeiro', icon: ChartNoAxesCombined, module: 'finance', tone: 'purple' },
  { label: 'Eventos', path: '/eventos', icon: CalendarHeart, module: 'events', tone: 'blue' },
  { label: 'Ideias e chamados', path: '/ideias', icon: MessageCircleMore, module: 'feedback', tone: 'pink' },
  { label: 'Configurações', path: '/configuracoes', icon: Settings, module: 'settings', tone: 'green' },
  { label: 'Visão geral', path: '/visao-geral', icon: ChartNoAxesCombined, module: 'dashboard' },
]

export const moduleGroups = [
  {
    title: 'Operacao',
    modules: ['Agenda', 'Alunos', 'Responsaveis', 'Turmas', 'Frequencia'],
  },
  {
    title: 'Gestao',
    modules: ['Mensalidades', 'Financeiro', 'Eventos'],
  },
  {
    title: 'Planejamento',
    modules: ['Ideias e chamados', 'Configuracoes'],
  },
]

export const documentationLinks = [
  { label: 'Arquitetura', path: 'docs/ARCHITECTURE.md', icon: FileText },
]
