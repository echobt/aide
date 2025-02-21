import { BaseEntity } from '@shared/entities'
import { v4 as uuidv4 } from 'uuid'
import * as vscode from 'vscode'

import { CodeEditTask, CodeEditTaskJson, CodeEditTaskState } from './types'

export class CodeEditTaskEntity extends BaseEntity<CodeEditTask> {
  protected getDefaults(override?: Partial<CodeEditTask>): CodeEditTask {
    return {
      id: uuidv4(),
      state: CodeEditTaskState.Initial,
      fileUri: vscode.Uri.file(''),
      isNewFile: false,
      selectionRange: new vscode.Range(0, 0, 0, 0),
      originalContent: '',
      newContent: '',
      ...override
    }
  }

  static toJson(task: CodeEditTask): CodeEditTaskJson {
    // eslint-disable-next-line unused-imports/no-unused-vars
    const { fileUri, selectionRange, error, abortController, ...rest } = task
    return {
      ...rest,
      fileUri: fileUri.toString(),
      selectionRange: {
        start: {
          line: selectionRange.start.line,
          character: selectionRange.start.character
        },
        end: {
          line: selectionRange.end.line,
          character: selectionRange.end.character
        }
      },
      error: error?.message
    }
  }

  static fromJson(
    taskJson: CodeEditTaskJson & {
      abortController?: AbortController
    }
  ): CodeEditTask {
    return new CodeEditTaskEntity({
      ...taskJson,
      fileUri: vscode.Uri.parse(taskJson.fileUri),
      selectionRange: new vscode.Range(
        taskJson.selectionRange.start.line,
        taskJson.selectionRange.start.character,
        taskJson.selectionRange.end.line,
        taskJson.selectionRange.end.character
      ),
      error: taskJson.error ? new Error(taskJson.error) : undefined
    }).entity
  }
}
