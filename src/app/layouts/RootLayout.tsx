import { Suspense, useMemo, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { LogOut, Menu, Palette, ShieldCheck } from 'lucide-react'
import { routePreloaders } from '@/app/router/routePreloaders'
import { canAccessModule } from '@/app/auth/permissions'
import { useAuth } from '@/app/providers/AuthProvider'
import { Badge } from '@/shared/components/ui/Badge'
import { Button } from '@/shared/components/ui/Button'
import { IconButton } from '@/shared/components/ui/IconButton'
import { Overlay } from '@/shared/components/ui/Overlay'
import { RouteSkeleton } from '@/shared/components/feedback/RouteSkeleton'
import { OfflineBanner } from '@/shared/components/feedback/OfflineBanner'
import { navigationItems } from '@/shared/constants/navigation'
import { cn } from '@/shared/utils/cn'

const preloadByPath = new Map([
  ['/', routePreloaders.dashboard],
  ['/agenda', routePreloaders.agenda],
  ['/alunos', routePreloaders.students],
  ['/responsaveis', routePreloaders.guardians],
  ['/turmas', routePreloaders.classes],
  ['/frequencia', routePreloaders.attendance],
  ['/mensalidades', routePreloaders.billing],
  ['/financeiro', routePreloaders.finance],
  ['/eventos', routePreloaders.events],
  ['/materiais', routePreloaders.materials],
  ['/ideias', routePreloaders.ideas],
  ['/relatorios', routePreloaders.reports],
  ['/configuracoes', routePreloaders.settings],
])

export function RootLayout() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const auth = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const mobileItems = navigationItems.filter((item) => ['/', '/agenda', '/alunos', '/frequencia'].includes(item.path) && canAccessModule(auth.roles, item.module))
  const isMoreActive = !mobileItems.some((item) => item.path === location.pathname)
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
      <header className="sticky top-0 z-30 border-b border-border bg-surface/95 backdrop-blur">
        <div className="flex h-16 items-center gap-2 px-4 lg:gap-3 lg:px-6">
          <IconButton
            className="lg:hidden"
            label="Abrir menu"
            onClick={() => setIsMobileMenuOpen(true)}
          >
            <Menu className="h-5 w-5" aria-hidden />
          </IconButton>

          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
              <Palette className="h-5 w-5" aria-hidden />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">Casa Criativa</p>
              <p className="truncate text-xs text-muted-foreground">Gestão escolar</p>
            </div>
          </div>

          <div className="ml-auto" />

          <Badge tone={auth.roles.length > 0 ? 'primary' : 'warning'}>{statusLabel}</Badge>
          <ShieldCheck className="hidden h-5 w-5 text-primary sm:block" aria-hidden />
          <Button
            className="hidden sm:inline-flex"
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
          <SidebarContent
            isSigningOut={isSigningOut}
            onSignOut={handleSignOut}
          />
        </aside>

        <Overlay isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} side="right" title="Explorar Casa Criativa">
              <SidebarContent
                isSigningOut={isSigningOut}
                onNavigate={() => setIsMobileMenuOpen(false)}
                onSignOut={handleSignOut}
              />
        </Overlay>

        <main className="app-main min-w-0 flex-1 px-4 py-5 md:px-6 lg:px-8">
          <Suspense fallback={<RouteSkeleton />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
      <nav className="mobile-navigation fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-surface lg:hidden" aria-label="Atalhos principais">
        {mobileItems.map((item) => (
          <NavLink key={item.path} to={item.path} end={item.path === '/'} onFocus={() => void preloadByPath.get(item.path)?.()}
            className={({ isActive }) => cn('flex min-h-16 min-w-0 flex-1 flex-col items-center justify-center gap-1 text-[11px] font-semibold', isActive ? 'text-primary' : 'text-muted-foreground')}>
            {({ isActive }) => <><span className={cn('flex h-7 w-12 items-center justify-center rounded-full', isActive && 'bg-primary/10')}><item.icon className="h-5 w-5" aria-hidden /></span><span>{item.path === '/' ? 'Início' : item.path === '/frequencia' ? 'Chamada' : item.label}</span></>}
          </NavLink>
        ))}
        <button type="button" aria-expanded={isMobileMenuOpen} onClick={() => setIsMobileMenuOpen(true)} className={cn('flex min-h-16 flex-1 flex-col items-center justify-center gap-1 text-[11px] font-semibold', isMoreActive ? 'text-primary' : 'text-muted-foreground')}>
          <span className={cn('flex h-7 w-12 items-center justify-center rounded-full', isMoreActive && 'bg-primary/10')}><Menu className="h-5 w-5" aria-hidden /></span>Mais
        </button>
      </nav>
    </div>
  )
}

function SidebarContent({
  isSigningOut,
  onNavigate,
  onSignOut,
}: {
  isSigningOut: boolean
  onNavigate?: () => void
  onSignOut: () => void
}) {
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
            onClick={onNavigate}
            onFocus={() => void preloadByPath.get(item.path)?.()}
            onMouseEnter={() => void preloadByPath.get(item.path)?.()}
            to={item.path}
          >
            <item.icon className="h-4 w-4 shrink-0" aria-hidden />
            <span className="truncate">{item.label}</span>
          </NavLink>
        ))}
      </div>
      <Button
        className="mt-3 w-full justify-start sm:hidden"
        isLoading={isSigningOut}
        leftIcon={<LogOut className="h-4 w-4" aria-hidden />}
        onClick={onSignOut}
        variant="secondary"
      >
        Sair
      </Button>
    </nav>
  )
}
