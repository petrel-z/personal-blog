type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogEntry {
  level: LogLevel
  message: string
  timestamp: string
  context?: Record<string, unknown>
}

class Logger {
  private formatEntry(entry: LogEntry): string {
    return JSON.stringify({
      ...entry,
      timestamp: new Date().toISOString(),
    })
  }

  debug(message: string, context?: Record<string, unknown>) {
    if (process.env.NODE_ENV === 'production') return
    console.debug(this.formatEntry({ level: 'debug', message, context }))
  }

  info(message: string, context?: Record<string, unknown>) {
    console.info(this.formatEntry({ level: 'info', message, context }))
  }

  warn(message: string, context?: Record<string, unknown>) {
    console.warn(this.formatEntry({ level: 'warn', message, context }))
  }

  error(message: string, error?: unknown, context?: Record<string, unknown>) {
    const errorContext = error instanceof Error
      ? { error: { message: error.message, stack: error.stack } }
      : { error }

    console.error(this.formatEntry({
      level: 'error',
      message,
      context: { ...context, ...errorContext },
    }))
  }
}

export const logger = new Logger()
