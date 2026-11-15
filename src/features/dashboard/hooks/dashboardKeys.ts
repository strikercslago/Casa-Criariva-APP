export const dashboardKeys = {
  all: ['dashboard'] as const,
  attention: (date: string) => [...dashboardKeys.all, 'attention', date] as const,
  attentionRoot: () => [...dashboardKeys.all, 'attention'] as const,
  operations: (referenceMonth: string) => [...dashboardKeys.all, 'operations', referenceMonth] as const,
  operationsRoot: () => [...dashboardKeys.all, 'operations'] as const,
  today: (date: string) => [...dashboardKeys.all, 'today', date] as const,
  todayRoot: () => [...dashboardKeys.all, 'today'] as const,
}
