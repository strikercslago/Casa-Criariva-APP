export type CalendarStatus = {
  generation: string
  status: 'disconnected' | 'connected' | 'reconnect' | 'error'
  email: string | null; calendarId: string | null; calendarName: string | null
  timeZone: string; lastSyncedAt: string | null; pending: boolean; revision: number
}
export type CalendarEvent = {
  id: string; etag: string; summary?: string; description?: string; location?: string; htmlLink?: string
  start?: { date?: string; dateTime?: string; timeZone?: string }
  end?: { date?: string; dateTime?: string; timeZone?: string }
  colorId?: string; recurrence?: string[]; recurringEventId?: string
}
export type EventDraft = {
  summary: string; description: string; location: string; start: string; end: string
  allDay: boolean; timeZone: string; colorId: string; recurrence?: string
}
export type EventPage = { events: CalendarEvent[]; nextPageToken?: string }
export const categories = [
  { id: '9', label: 'Reuniões', color: '#405baf' },
  { id: '10', label: 'Oficinas', color: '#16794b' },
  { id: '3', label: 'Eventos', color: '#8845ac' },
  { id: '6', label: 'Administrativo', color: '#a34b16' },
  { id: '8', label: 'Outros', color: '#5c6470' },
] as const
