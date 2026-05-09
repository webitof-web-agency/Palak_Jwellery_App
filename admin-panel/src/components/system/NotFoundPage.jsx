import { Link } from 'react-router-dom'
import PageHeader from '../ui/PageHeader'

export default function NotFoundPage() {
  return (
    <main className="page-shell min-h-screen flex items-center justify-center">
      <div className="w-full max-w-2xl">
        <PageHeader
          eyebrow="Route Not Found"
          title="Page not found"
          description="The address you opened does not match any admin route. Use the buttons below to return to a valid workspace."
        />

        <section className="surface-card space-y-5">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-primary">
            The route may have changed, or the page may not be available to your role.
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              to="/dashboard"
              className="primary-luxury-button px-6 py-3"
            >
              Go to Dashboard
            </Link>
            <Link
              to="/sales"
              className="luxury-button border border-white/10 bg-white/5 hover:bg-white/10 px-6 py-3"
            >
              Open Sales
            </Link>
          </div>
        </section>
      </div>
    </main>
  )
}
