import { useEffect, useState } from 'react'

export interface ElementSize {
  width: number
  height: number
}

const defaultState: ElementSize = {
  width: 0,
  height: 0
}

export const useElementSize = (
  elementRef: React.RefObject<Element | null>
): ElementSize => {
  const [size, setSize] = useState<ElementSize>(defaultState)

  const updateSize = () => {
    if (!elementRef.current) return

    const { width, height } = elementRef.current.getBoundingClientRect()
    setSize(prev => {
      if (prev.width === width && prev.height === height) {
        return prev
      }
      return { width, height }
    })
  }

  useEffect(() => {
    if (!elementRef.current) return

    updateSize()

    const observer = new ResizeObserver(() => {
      updateSize()
    })

    observer.observe(elementRef.current)

    return () => {
      observer.disconnect()
    }
  }, [elementRef, updateSize])

  return size
}
