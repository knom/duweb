import { useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, Menu, Search, User, X } from 'lucide-react'
import { Button } from './ui/button'
import { Input } from './ui/input'

interface AppHeaderProps {
  logoUrl: string
  sidebarOpen: boolean
  scanPath: string
  starting: boolean
  authRequired: boolean
  authUsername: string | null
  onToggleSidebar: () => void
  onScanPathChange: (value: string) => void
  fetchPathSuggestions: (query: string, signal?: AbortSignal) => Promise<string[]>
  onStartScan: () => void
}

export function AppHeader({
  logoUrl,
  sidebarOpen,
  scanPath,
  starting,
  authRequired,
  authUsername,
  onToggleSidebar,
  onScanPathChange,
  fetchPathSuggestions,
  onStartScan,
}: AppHeaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [pathSuggestions, setPathSuggestions] = useState<string[]>([])
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1)

  const shouldShowDropdown = showSuggestions && (loadingSuggestions || pathSuggestions.length > 0)

  function closeSuggestions(): void {
    setShowSuggestions(false)
    setLoadingSuggestions(false)
    setPathSuggestions([])
    setActiveSuggestionIndex(-1)
  }

  useEffect(() => {
    if (!showSuggestions) {
      return
    }

    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      try {
        setLoadingSuggestions(true)
        const suggestions = await fetchPathSuggestions(scanPath, controller.signal)
        setPathSuggestions(suggestions)
        setActiveSuggestionIndex(suggestions.length > 0 ? 0 : -1)
      } catch {
        if (!controller.signal.aborted) {
          setPathSuggestions([])
          setActiveSuggestionIndex(-1)
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoadingSuggestions(false)
        }
      }
    }, 150)

    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [fetchPathSuggestions, scanPath, showSuggestions])

  const activeSuggestion = useMemo(() => {
    if (activeSuggestionIndex < 0 || activeSuggestionIndex >= pathSuggestions.length) {
      return null
    }

    return pathSuggestions[activeSuggestionIndex]
  }, [activeSuggestionIndex, pathSuggestions])

  function applySuggestion(value: string): void {
    onScanPathChange(value)
    setPathSuggestions([])
    setActiveSuggestionIndex(-1)
    // Refocus input and keep dropdown ready for next typing
    inputRef.current?.focus()
    setShowSuggestions(true)
  }

  return (
    <header className="sticky top-0 z-30 rounded-xl border border-slate-200 bg-white/90 px-4 py-3 shadow-sm backdrop-blur">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight md:gap-3 md:text-2xl">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-8 w-8 p-0 lg:hidden"
              onClick={onToggleSidebar}
              aria-label={sidebarOpen ? 'Close jobs sidebar' : 'Open jobs sidebar'}
            >
              {sidebarOpen ? <X className="h-3.5 w-3.5" /> : <Menu className="h-3.5 w-3.5" />}
            </Button>
            <img src={logoUrl} alt="DiskUsage Web logo" className="h-8 w-8 md:h-10 md:w-10" />
            <span>Disk Usage Web</span>
          </h1>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="relative w-full sm:w-90">
            <label htmlFor="scan-path" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Scan path
            </label>
            <Input
              ref={inputRef}
              id="scan-path"
              value={scanPath}
              onChange={(event) => onScanPathChange(event.target.value)}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => {
                window.setTimeout(() => {
                  closeSuggestions()
                }, 120)
              }}
              onKeyDown={(event) => {
                if (!shouldShowDropdown) {
                  return
                }

                if (event.key === 'ArrowDown') {
                  event.preventDefault()
                  setActiveSuggestionIndex((index) => Math.min(index + 1, pathSuggestions.length - 1))
                  return
                }

                if (event.key === 'ArrowUp') {
                  event.preventDefault()
                  setActiveSuggestionIndex((index) => Math.max(index - 1, 0))
                  return
                }

                if (event.key === 'Enter' && activeSuggestion) {
                  event.preventDefault()
                  applySuggestion(activeSuggestion)
                  return
                }

                if (event.key === 'Escape') {
                  closeSuggestions()
                }
              }}
              placeholder="/home"
            />

            {shouldShowDropdown && (
              <div className="absolute z-40 mt-1 w-full overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg">
                {loadingSuggestions ? (
                  <div className="flex items-center gap-2 px-3 py-2 text-sm text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                    Finding paths...
                  </div>
                ) : (
                  <ul className="max-h-56 overflow-auto py-1">
                    {pathSuggestions.map((suggestion, index) => (
                      <li key={suggestion}>
                        <button
                          type="button"
                          className={`w-full px-3 py-2 text-left text-sm ${
                            index === activeSuggestionIndex ? 'bg-cyan-50 text-cyan-900' : 'text-slate-700 hover:bg-slate-50'
                          }`}
                          onMouseDown={(event) => {
                            event.preventDefault()
                          }}
                          onClick={() => applySuggestion(suggestion)}
                        >
                          {suggestion}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center">
            <Button type="button" className="w-full sm:w-auto" onClick={onStartScan} disabled={starting || !scanPath.trim()}>
              <Search className="h-4 w-4" />
              {starting ? 'Starting...' : 'Scan'}
            </Button>
            {authRequired && authUsername && (
              <div
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-700"
                aria-label="Authenticated user"
              >
                <User className="h-4 w-4 text-slate-500" />
                <span>{authUsername}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
