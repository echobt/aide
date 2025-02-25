import { logger } from '@extension/logger'
import * as vscode from 'vscode'

import { SuggestionTrigger } from '../core/types'

/**
 * Class for handling automatic imports
 */
export class AutoImportHandler {
  private disposables: vscode.Disposable[] = []

  constructor() {
    const commandDisposable = vscode.commands.registerCommand(
      'aide.addImports',
      (imports, position, trigger) => {
        this.handleAddImports(imports, position, trigger)
      }
    )

    this.disposables.push(commandDisposable)
  }

  /**
   * Create import command for completion item
   */
  createImportCommand(
    imports: Array<{ name: string; path: string }> | undefined,
    position: vscode.Position,
    trigger: SuggestionTrigger
  ): vscode.Command | undefined {
    // Check if entry has imports
    if (!imports || imports.length === 0) {
      return undefined
    }

    // Create command to add imports
    return {
      title: 'Add Imports',
      command: 'aide.addImports',
      arguments: [imports, position, trigger]
    }
  }

  /**
   * Handle adding imports
   */
  handleAddImports(
    imports: Array<{ name: string; path: string }>,
    _position?: vscode.Position,
    _trigger?: SuggestionTrigger
  ): void {
    try {
      if (!imports || imports.length === 0) {
        return
      }

      const editor = vscode.window.activeTextEditor
      if (!editor) {
        return
      }

      const { document } = editor
      const text = document.getText()

      // process each import
      editor.edit(editBuilder => {
        // find the import statement area in the file
        const importRegex = /^import\s+.*?from\s+['"].*?['"]/gm
        const importMatches = [...text.matchAll(importRegex)]

        // if no import statement is found, add at the top of the file
        if (importMatches.length === 0) {
          const firstLine = new vscode.Position(0, 0)
          const importStatements = `${imports
            .map(imp => `import { ${imp.name} } from '${imp.path}';`)
            .join('\n')}\n\n`

          editBuilder.insert(firstLine, importStatements)
          return
        }

        // find the position of the last import statement
        const lastImport = importMatches[importMatches.length - 1]
        if (!lastImport || lastImport.index === undefined) {
          // if cannot determine the position of the last import, add at the top of the file
          const firstLine = new vscode.Position(0, 0)
          const importStatements = `${imports
            .map(imp => `import { ${imp.name} } from '${imp.path}';`)
            .join('\n')}\n\n`

          editBuilder.insert(firstLine, importStatements)
          return
        }

        const lastImportEndPos = document.positionAt(
          lastImport.index + lastImport[0].length
        )
        const lastImportEndLine = lastImportEndPos.line

        // check if each import already exists
        const newImports = imports.filter(imp => {
          // simple check if the import already exists
          const importPattern = new RegExp(
            `import\\s+{[^}]*?\\b${imp.name}\\b[^}]*?}\\s+from\\s+['"]${imp.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`
          )
          return !importPattern.test(text)
        })

        if (newImports.length === 0) {
          return // all imports already exist
        }

        // add new imports after the last import statement
        const insertPosition = new vscode.Position(lastImportEndLine + 1, 0)
        const importStatements = newImports
          .map(imp => `import { ${imp.name} } from '${imp.path}';`)
          .join('\n')

        editBuilder.insert(insertPosition, `${importStatements}\n`)
      })
    } catch (error) {
      logger.error('Error handling imports', error)
    }
  }

  dispose(): void {
    this.disposables.forEach(disposable => disposable.dispose())
    this.disposables = []
  }
}
