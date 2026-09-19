import { Link } from 'react-router-dom'

/** Renders a doctor as a link to their detail page, or "Not specified" if none is set. */
export function PhysicianLink({ doctor }) {
  if (!doctor) return 'Not specified'
  return (
    <Link to={`/doctors/${doctor.id}`} className="text-glow-b hover:underline">
      Dr. {doctor.first_name} {doctor.last_name}
    </Link>
  )
}
