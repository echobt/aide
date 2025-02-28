export const connectWMCode = `
// Collect console logs
const originalConsole = {
  log: console.log,
  error: console.error,
  warn: console.warn,
  info: console.info
}

const logs = []
let isHandshakeComplete = false

const consoleHandler =
  type =>
  (...args) => {
    // Call original console method
    originalConsole[type](...args)

    // Store log with more detailed information
    const logEntry = {
      type,
      content: args
        .map(arg => {
          try {
            if (arg instanceof Error) {
              return arg.stack || arg.message
            }
            return typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
          } catch (e) {
            return String(arg)
          }
        })
        .join(' '),
      timestamp: new Date().toISOString()
    }

    logs.push(logEntry)

    // Only send log immediately to parent if handshake is complete
    if (isHandshakeComplete) {
      window.parent.postMessage(
        {
          type: 'CONSOLE_LOG',
          log: logEntry
        },
        '*'
      )
    }
  }

// Override console methods
window.console.log = consoleHandler('log')
window.console.error = consoleHandler('error')
window.console.warn = consoleHandler('warn')
window.console.info = consoleHandler('info')

// Capture uncaught errors
window.addEventListener('error', function(event) {
  const errorMessage = event.message || 'Unknown error'
  const errorStack = event.error && event.error.stack ? event.error.stack : ''
  const errorContent = errorMessage + '\\n' + errorStack

  // Create error log entry
  const errorLogEntry = {
    type: 'error',
    content: 'Uncaught error: ' + errorContent,
    timestamp: new Date().toISOString()
  }

  // Store in logs
  logs.push(errorLogEntry)

  // Send immediately if handshake is complete
  if (isHandshakeComplete) {
    window.parent.postMessage(
      {
        type: 'CONSOLE_LOG',
        log: errorLogEntry
      },
      '*'
    )
  }

  // Prevent default handling
  event.preventDefault()
})

// Capture unhandled promise rejections
window.addEventListener('unhandledrejection', function(event) {
  let rejectionReason = 'Unknown promise rejection'

  if (event.reason) {
    if (event.reason.stack) {
      rejectionReason = event.reason.stack
    } else if (event.reason.message) {
      rejectionReason = event.reason.message
    } else {
      rejectionReason = String(event.reason)
    }
  }

  // Create error log entry
  const rejectionLogEntry = {
    type: 'error',
    content: 'Unhandled promise rejection: ' + rejectionReason,
    timestamp: new Date().toISOString()
  }

  // Store in logs
  logs.push(rejectionLogEntry)

  // Send immediately if handshake is complete
  if (isHandshakeComplete) {
    window.parent.postMessage(
      {
        type: 'CONSOLE_LOG',
        log: rejectionLogEntry
      },
      '*'
    )
  }

  // Prevent default handling
  event.preventDefault()
})

// Handle messages from parent
window.addEventListener('message', async event => {
  const { type, id, code } = event.data

  // Handle handshake request from parent
  if (type === 'HANDSHAKE_REQUEST') {
    isHandshakeComplete = true
    // Send all stored logs at once
    window.parent.postMessage(
      {
        type: 'INITIAL_LOGS',
        logs
      },
      '*'
    )

    // Confirm handshake completion
    window.parent.postMessage(
      {
        type: 'HANDSHAKE_COMPLETE'
      },
      '*'
    )
  }

  if (type === 'EXECUTE_CODE') {
    try {
      // Execute code and get result
      const result = await eval(code)

      // Send result back
      window.parent.postMessage(
        {
          type: 'CODE_RESULT',
          id,
          result: String(result)
        },
        '*'
      )
    } catch (error) {
      window.parent.postMessage(
        {
          type: 'CODE_ERROR',
          id,
          error: error.message
        },
        '*'
      )
    }
  }

  // Handle history navigation
  if (type === 'HISTORY_BACK') {
    window.history.back()
  }

  if (type === 'HISTORY_FORWARD') {
    window.history.forward()
  }
})

// Notify parent that VM is ready for handshake
window.parent.postMessage(
  {
    type: 'VM_READY'
  },
  '*'
)

// Listen for URL changes and notify parent
window.addEventListener('popstate', () => {
  window.parent.postMessage(
    {
      type: 'URL_CHANGE',
      url: window.location.href
    },
    '*'
  )
})

`
