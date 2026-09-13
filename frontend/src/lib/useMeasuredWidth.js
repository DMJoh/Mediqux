import { useEffect, useRef, useState } from 'react'

/** Tracks an element's rendered pixel width, so SVG charts can build their viewBox
 * from real dimensions instead of stretching a fixed coordinate system to fit. */
export function useMeasuredWidth() {
  const ref = useRef(null)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return undefined
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(el)
    setWidth(el.getBoundingClientRect().width)
    return () => observer.disconnect()
  }, [])

  return [ref, width]
}
