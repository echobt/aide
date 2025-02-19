export const connectWMCode = `
// Collect console logs
const originalConsole = {
  log: console.log,
  error: console.error,
  warn: console.warn,
  info: console.info
}

const logs = []
const consoleHandler =
  type =>
  (...args) => {
    // Call original console method
    originalConsole[type](...args)

    // Store log with more detailed information
    logs.push({
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
    })

    // Send log immediately to parent
    window.parent.postMessage(
      {
        type: 'CONSOLE_LOG',
        log: {
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
      },
      '*'
    )
  }

// Override console methods
console.log = consoleHandler('log')
console.error = consoleHandler('error')
console.warn = consoleHandler('warn')
console.info = consoleHandler('info')

// Handle messages from parent
window.addEventListener('message', async event => {
  const { type, id, code } = event.data

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

// Send initial logs
window.parent.postMessage(
  {
    type: 'INITIAL_LOGS',
    logs
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
