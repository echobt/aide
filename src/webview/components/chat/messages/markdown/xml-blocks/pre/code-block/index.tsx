import { useCodeBlockContext } from '../context/code-block-context'
import { FileBlock } from './file-block'
import { MermaidBlock } from './mermaid-block'

export const CodeBlock = () => {
  const { mdLang: markdownLang } = useCodeBlockContext()

  // Render Mermaid if enabled and language is mermaid
  if (markdownLang === 'mermaid') {
    return <MermaidBlock />
  }

  return <FileBlock />
}
