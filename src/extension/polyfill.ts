const enableFetchPolyfill = async () => {
  if (!globalThis.fetch) {
    // if globalThis.fetch is not available, we use undici
    const { fetch, FormData, Headers, Request, Response } = await import(
      'undici'
    )

    Object.assign(globalThis, {
      fetch,
      FormData,
      Headers,
      Request,
      Response
    })
  }

  // fuck, vscode fetch not working on v1.92.0
  // we add a polyfill here
  // const {
  //   default: fetch,
  //   Headers,
  //   Request,
  //   Response
  // } = await import('node-fetch')
  // const { default: FormData } = await import('form-data')

  // Object.assign(globalThis, {
  //   fetch,
  //   FormData,
  //   Headers,
  //   Request,
  //   Response
  // })
}

export const enablePolyfill = async () => {
  await enableFetchPolyfill()
}
