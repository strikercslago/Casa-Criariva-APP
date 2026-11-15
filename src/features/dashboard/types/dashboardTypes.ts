import type { Database } from '@/lib/supabase/database.types'

export type DashboardToday = Database['public']['Functions']['get_dashboard_today']['Returns'][number]
export type DashboardAttentionItem = Database['public']['Functions']['get_dashboard_attention']['Returns'][number]
export type DashboardOperations = Database['public']['Functions']['get_dashboard_operations']['Returns'][number]
