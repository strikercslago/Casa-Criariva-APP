import { Suspense, useMemo, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { LogOut, ShieldCheck } from 'lucide-react'
import casaCriativaLogo from '@/assets/brand/casa-criativa-logo.png'
import { routePreloaders } from '@/app/router/routePreloaders'
import { canAccessModule } from '@/app/auth/permissions'
import { useAuth } from '@/app/providers/AuthProvider'
import { Badge } from '@/shared/components/ui/Badge'
import { Button } from '@/shared/components/ui/Button'
import { MobileBottomNavigation } from '@/shared/components/navigation/MobileBottomNavigation'
import { RouteSkeleton } from '@/shared/components/feedback/RouteSkeleton'
import { OfflineBanner } from '@/shared/components/feedback/OfflineBanner'
import { navigationItems } from '@/shared/constants/navigation'
import { cn } from '@/shared/utils/cn'

const preloadByPath = new Map([
  ['/', routePreloaders.mainMenu],
  ['/visao-geral', routePreloaders.dashboard],
  ['/agenda', routePreloaders.agenda],
  ['/alunos', routePreloaders.students],
  ['/responsaveis', routePreloaders.guardians],
  ['/turmas', routePreloaders.classes],
  ['/frequencia', routePreloaders.attendance],
  ['/mensalidades', routePreloaders.billing],
  ['/financeiro', routePreloaders.finance],
  ['/eventos', routePreloaders.events],
  ['/ideias', routePreloaders.ideas],
  ['/configuracoes', routePreloaders.settings],
])

export function RootLayout() {
  const [isSigningOut, setIsSigningOut] = useState(false)
  const auth = useAuth()
  const navigate = useNavigate()
  const statusLabel = useMemo(() => {
    if (auth.roles.includes('owner')) {
      return 'Owner'
    }

    if (auth.roles.includes('admin')) {
      return 'Admin'
    }

    if (auth.roles.includes('teacher')) {
      return 'Professor'
    }

    return auth.isAccountLoading ? 'Carregando acesso' : 'Sem role'
  }, [auth.isAccountLoading, auth.roles])

  async function handleSignOut() {
    setIsSigningOut(true)
    await auth.signOut()
    setIsSigningOut(false)
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <OfflineBanner />
      <header className="brand-header sticky top-0 z-30 border-b border-border bg-surface/95 backdrop-blur">
        <div className="flex h-16 items-center gap-2 px-4 lg:gap-3 lg:px-6">
          <NavLink to="/" aria-label="Casa Criativa — Menu Principal" className="flex min-w-0 items-center gap-2">
            <img src={casaCriativaLogo} alt="Logo oficial da Casa Criativa" className="h-14 w-14 shrink-0 rounded-xl object-contain" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">Casa Criativa</p>
              <p className="truncate text-xs text-muted-foreground">Gestão Escolar</p>
            </div>
          </NavLink>

          <div className="ml-auto" />

          <span className="hidden sm:inline-flex"><Badge tone={auth.roles.length > 0 ? 'primary' : 'warning'}>{statusLabel}</Badge></span>
          <ShieldCheck className="hidden h-5 w-5 text-primary sm:block" aria-hidden />
          <Button
            className="shrink-0"
            isLoading={isSigningOut}
            leftIcon={<LogOut className="h-4 w-4" aria-hidden />}
            onClick={handleSignOut}
            variant="secondary"
          >
            Sair
          </Button>
        </div>
      </header>

      <div className="flex">
        <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-64 shrink-0 border-r border-border bg-surface lg:block">
          <SidebarContent />
        </aside>

        <main className="app-main min-w-0 flex-1 px-4 py-5 md:px-6 lg:px-8">
          <Suspense fallback={<RouteSkeleton />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
      <MobileBottomNavigation />
    </div>
  )
}

function SidebarContent() {
  const auth = useAuth()
  const visibleItems = navigationItems.filter((item) => canAccessModule(auth.roles, item.module))

  return (
    <nav className="flex h-full flex-col gap-1 overflow-y-auto p-3" aria-label="Navegacao principal">
      <div className="flex flex-1 flex-col gap-1">
        {visibleItems.map((item) => (
          <NavLink
            className={({ isActive }) =>
              cn(
                'flex min-h-12 items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground transition-colors',
                'hover:bg-muted hover:text-foreground',
                isActive && 'bg-primary/10 text-primary',
              )
            }
            end={item.path === '/'}
            key={item.path}
            onFocus={() => void preloadByPath.get(item.path)?.()}
            onMouseEnter={() => void preloadByPath.get(item.path)?.()}
            to={item.path}
          >
            <item.icon className="h-4 w-4 shrink-0" aria-hidden />
            <span className="truncate">{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
