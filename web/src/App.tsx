import { BrowserRouter, NavLink, Route, Routes } from 'react-router'
import { cn } from '@/lib/utils'
import { AmbiencePage } from '@/pages/AmbiencePage'
import { LofiPage } from '@/pages/LofiPage'

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'rounded-md px-3 py-1.5 text-sm transition-colors',
    isActive ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground',
  )

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-svh bg-background text-foreground">
        <header className="flex items-center justify-between border-b px-6 py-3">
          <span className="font-semibold">MusicGenerator</span>
          <nav className="flex gap-1">
            <NavLink to="/" end className={navLinkClass}>
              Ambience
            </NavLink>
            <NavLink to="/lofi" className={navLinkClass}>
              Lofi
            </NavLink>
          </nav>
        </header>
        <main className="mx-auto max-w-3xl px-6 py-12">
          <Routes>
            <Route path="/" element={<AmbiencePage />} />
            <Route path="/lofi" element={<LofiPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
