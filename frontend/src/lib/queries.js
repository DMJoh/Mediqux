import { useQuery } from '@tanstack/react-query'
import { api } from './api'

export function usePatients() {
  return useQuery({ queryKey: ['patients'], queryFn: () => api.get('/patients') })
}

export function useDoctors() {
  return useQuery({ queryKey: ['doctors'], queryFn: () => api.get('/doctors') })
}

export function useInstitutions() {
  return useQuery({ queryKey: ['institutions'], queryFn: () => api.get('/institutions') })
}

export function useAppointments() {
  return useQuery({ queryKey: ['appointments'], queryFn: () => api.get('/appointments') })
}

export function useMedications() {
  return useQuery({ queryKey: ['medications'], queryFn: () => api.get('/medications') })
}

/** All institutions, for the doctor form's institution picker — the backend returns every
 * institution unconditionally (no per-doctor filtering), so "already assigned" is handled client-side. */
export function useAvailableInstitutions() {
  return useQuery({ queryKey: ['institutions', 'available'], queryFn: () => api.get('/doctors/institutions/available') })
}

export function useUpcomingAppointments() {
  return useQuery({
    queryKey: ['appointments', 'upcoming'],
    queryFn: () => api.get('/appointments/dashboard/upcoming'),
  })
}

export function useAppointmentStats() {
  return useQuery({
    queryKey: ['appointments', 'stats'],
    queryFn: () => api.get('/appointments/stats/summary'),
  })
}

function isoDate(d) {
  return d.toISOString().slice(0, 10)
}

/** Appointments from the last `months` months, for client-side monthly bucketing (no server aggregation endpoint exists). */
export function useRecentAppointments(months = 6) {
  const to = new Date()
  const from = new Date()
  from.setMonth(from.getMonth() - (months - 1))
  from.setDate(1)

  return useQuery({
    queryKey: ['appointments', 'recent', months],
    queryFn: () => api.get(`/appointments?date_from=${isoDate(from)}&date_to=${isoDate(to)}`),
  })
}

/** Buckets appointments into the last `months` calendar months: [{ label, count, date }]. */
export function bucketByMonth(appointments, months = 6) {
  const buckets = []
  const now = new Date()
  for (let i = months - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    buckets.push({ label: d.toLocaleDateString('en-US', { month: 'short' }), year: d.getFullYear(), month: d.getMonth(), count: 0 })
  }
  for (const appt of appointments ?? []) {
    const d = new Date(appt.appointment_date)
    const bucket = buckets.find((b) => b.year === d.getFullYear() && b.month === d.getMonth())
    if (bucket) bucket.count += 1
  }
  return buckets
}
