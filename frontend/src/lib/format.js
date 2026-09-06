export function formatDate(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr)
  return `${d.getUTCDate()}/${d.getUTCMonth() + 1}/${d.getUTCFullYear()}`
}

export function formatDateLong(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}

export function formatDateTime(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr)
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function calculateAge(dateOfBirth) {
  if (!dateOfBirth) return null
  const today = new Date()
  const birth = new Date(dateOfBirth)
  let age = today.getFullYear() - birth.getFullYear()
  const monthDiff = today.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age -= 1
  return age
}

const PHONE_REGEX = /^[\d+\s-]+$/

export function isValidPhone(value) {
  return !value || PHONE_REGEX.test(value)
}

export function isValidEmail(value) {
  return !value || value.includes('@')
}

export function isValidWebsite(value) {
  return !value || /^https?:\/\/.+/i.test(value)
}

/** ISO datetime -> "YYYY-MM-DDTHH:mm" for a <input type="datetime-local"> value, in local time. */
export function toDatetimeLocal(isoStr) {
  if (!isoStr) return ''
  const d = new Date(isoStr)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function formatDateTimeLong(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
}

export function formatTime(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
