import { RefObject, useEffect, useState } from 'react'
import { useGlobalContext } from '@webview/contexts/global-context'
import { logger } from '@webview/utils/logger'
import mermaid from 'mermaid'

function useIsVisible(ref: RefObject<HTMLElement>) {
  const [isIntersecting, setIsIntersecting] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) {
        observer.disconnect()
        setIsIntersecting(true)
      }
    })

    observer.observe(ref.current)
    return () => {
      observer.disconnect()
    }
  }, [ref])

  return isIntersecting
}

export const useMermaid = (
  content: string,
  containerRef: RefObject<HTMLElement>
) => {
  const [svg, setSvg] = useState('')
  const { isDarkTheme } = useGlobalContext()
  const isVisible = useIsVisible(containerRef)

  useEffect(() => {
    if (!isVisible) {
      return
    }

    const renderChart = async () => {
      try {
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'loose',
          fontFamily: 'inherit',
          themeCSS: 'margin: 1.5rem auto 0;',
          theme: isDarkTheme ? 'dark' : 'default'
        })
        const { svg } = await mermaid.render(
          `mermaid-${Date.now()}`,
          content.replaceAll('\\n', '\n'),
          containerRef.current
        )
        setSvg(svg)
      } catch (error) {
        logger.warn('Error while rendering mermaid:', error)
      }
    }

    const htmlElement = document.documentElement
    const observer = new MutationObserver(renderChart)
    observer.observe(htmlElement, { attributes: true })
    renderChart()

    return () => {
      observer.disconnect()
    }
  }, [content, isVisible, isDarkTheme, containerRef.current])

  return svg
}
