import { getSupabaseClient } from '@/lib/supabase/client'
import { AppError } from '@/lib/errors/AppError'

export const googleCalendarEnabled = import.meta.env.VITE_GOOGLE_CALENDAR_ENABLED === 'true'

export async function calendarRequest<T>(action: string, values: Record<string, unknown> = {}): Promise<T> {
  const client = getSupabaseClient()
  if (!client || !googleCalendarEnabled) throw new AppError('configuration', 'A conexão com Google Calendar ainda não está disponível neste ambiente.')
  const { data, error } = await client.functions.invoke('google-calendar', { body: { ...values, action } })
  if (error) {
    const response = error.context instanceof Response ? await error.context.json().catch(() => null) : null
    const code = response?.code === 'permission' ? 'permission' : response?.code === 'auth' ? 'auth' : 'unknown'
    throw new AppError(code, typeof response?.error === 'string' ? response.error : 'Não foi possível acessar o Google Calendar. Verifique a conexão e tente novamente.')
  }
  return data as T
}
