import { AppHeader } from './components/AppHeader'
import { DirectoryTreeCard } from './components/DirectoryTreeCard'
import { JobsSidebar } from './components/JobsSidebar'
import { useJobsController } from './hooks/useJobsController'

function App() {
  const {
    apiUrl,
    scanPath,
    setScanPath,
    job,
    selectedJobId,
    search,
    setSearch,
    filter,
    setFilter,
    error,
    loadingJobs,
    starting,
    sidebarOpen,
    setSidebarOpen,
    authRequired,
    authUsername,
    fetchPathSuggestions,
    filteredJobs,
    startScan,
    rerunSelectedJob,
    removeSelectedJob,
    selectJob,
  } = useJobsController()

  const logoUrl = `${import.meta.env.BASE_URL}favicon.svg`

  return (
    <main className="h-screen overflow-hidden bg-[radial-gradient(circle_at_10%_15%,rgba(14,165,233,0.18),transparent_38%),radial-gradient(circle_at_88%_0%,rgba(16,185,129,0.14),transparent_36%),linear-gradient(170deg,#f5f7fb_0%,#eef3f8_42%,#f8fafc_100%)] text-slate-900">
      <div className="mx-auto flex h-full min-h-0 w-full max-w-7xl flex-col gap-4 p-0 md:p-6">
        <AppHeader
          logoUrl={logoUrl}
          sidebarOpen={sidebarOpen}
          scanPath={scanPath}
          starting={starting}
          authRequired={authRequired}
          authUsername={authUsername}
          onToggleSidebar={() => setSidebarOpen((value) => !value)}
          onScanPathChange={setScanPath}
          fetchPathSuggestions={fetchPathSuggestions}
          onStartScan={startScan}
        />

        {sidebarOpen && (
          <button
            type="button"
            aria-label="Close sidebar overlay"
            className="fixed inset-0 z-40 bg-slate-900/30 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <div className="grid flex-1 min-h-0 gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
          <JobsSidebar
            sidebarOpen={sidebarOpen}
            search={search}
            filter={filter}
            loadingJobs={loadingJobs}
            filteredJobs={filteredJobs}
            selectedJobId={selectedJobId}
            error={job?.error ?? error}
            hasSelectedJob={Boolean(job)}
            onCloseSidebar={() => setSidebarOpen(false)}
            onSearchChange={setSearch}
            onFilterChange={setFilter}
            onSelectJob={(selectedJob) => {
              selectJob(selectedJob)
              setSidebarOpen(false)
            }}
            onRerunSelectedJob={rerunSelectedJob}
            onRemoveSelectedJob={removeSelectedJob}
          />

          <DirectoryTreeCard job={job} apiUrl={apiUrl} />
        </div>
      </div>
    </main>
  )
}

export default App