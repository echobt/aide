import chalk from 'chalk'

import { getErrorMsg } from './common'

chalk.level = 3
const maxLogBufferLength = 100

export interface BaseLoggerOptions {
  name: string
  level?: string
  isDevLogger?: boolean
}

export abstract class BaseLogger {
  protected loggerName: string

  protected level: string

  protected isDevLogger: boolean

  logBuffer: string[] = []

  constructor(options: BaseLoggerOptions) {
    const { name, level = 'info', isDevLogger = false } = options
    this.loggerName = name
    this.level = level
    this.isDevLogger = isDevLogger
  }

  protected abstract isDev(): boolean
  protected abstract outputLog(message: string): void

  private getColoredLevel(level: string): string {
    switch (level) {
      case 'info':
        return chalk.green('INFO')
      case 'warn':
        return chalk.yellow('WARN')
      case 'error':
        return chalk.red('ERROR')
      case 'debug':
        return chalk.blue('DEBUG')
      default:
        return level.toUpperCase()
    }
  }

  private stringifyIfObject(level: string, value: any): string {
    if (['error', 'warn'].includes(level)) {
      return getErrorMsg(value)
    }

    if (typeof value === 'object' && value !== null) {
      return JSON.stringify(value)
    }
    return getErrorMsg(value)
  }

  private shouldLog(): boolean {
    return this.level !== 'silent' && (!this.isDevLogger || this.isDev())
  }

  protected formatLogMetadata(level: string): {
    coloredLevel: string
    dateTime: string
    loggerName: string
  } {
    const coloredLevel = this.getColoredLevel(level)
    const dateTime = new Date().toISOString().split('T')[1]?.split('.')[0]
    const loggerName = chalk.magenta(`[${this.loggerName}]`)
    return { coloredLevel, dateTime: `[${dateTime}]`, loggerName }
  }

  protected formatLogForSave(level: string, ...messages: any[]): string {
    const { coloredLevel, dateTime, loggerName } = this.formatLogMetadata(level)

    return `${loggerName} ${coloredLevel} ${chalk.green(dateTime)} ${messages
      .map(msg => this.stringifyIfObject(level, msg))
      .join(' ')}`
  }

  protected formatLogForConsoleLog(level: string, ...messages: any[]): any[] {
    const { coloredLevel, dateTime, loggerName } = this.formatLogMetadata(level)

    return [
      `${loggerName} ${coloredLevel} ${chalk.green(dateTime)}`,
      ...messages
    ]
  }

  private logMethod(level: string, ...messages: any[]): void {
    if (this.shouldLog()) {
      const formattedLogForSave = this.formatLogForSave(level, ...messages)
      const formattedLogForConsole = this.formatLogForConsoleLog(
        level,
        ...messages
      )

      // eslint-disable-next-line no-console
      console.log(...formattedLogForConsole)
      this.outputLog(formattedLogForSave)
      this.logBuffer.push(formattedLogForSave)

      // limit log buffer size, keep only last 100 logs
      if (this.logBuffer.length > maxLogBufferLength) {
        this.logBuffer = this.logBuffer.slice(-maxLogBufferLength)
      }
    }
  }

  log(...messages: any[]): void {
    this.logMethod('info', ...messages)
  }

  warn(...messages: any[]): void {
    this.logMethod('warn', ...messages)
  }

  error(...messages: any[]): void {
    this.logMethod('error', ...messages)
  }

  verbose(...messages: any[]): void {
    this.logMethod('debug', ...messages)
  }

  setLevel(level: string): void {
    this.level = level
  }

  get dev(): BaseLogger {
    if (this.isDevLogger) return this
    const DevLogger = this.constructor as new (
      options: BaseLoggerOptions
    ) => BaseLogger
    return new DevLogger({
      name: `${this.loggerName}:dev`,
      level: this.level,
      isDevLogger: true
    })
  }

  abstract saveLogsToFile(): Promise<void>
  abstract destroy(): void
}
