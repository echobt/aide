import EventEmitter3 from 'eventemitter3'

export class EventEmitter<
  EventTypes extends EventEmitter3.ValidEventTypes = string | symbol,
  Context = any
> extends EventEmitter3<EventTypes, Context> {
  async emitWaitForDone<T extends EventEmitter3.EventNames<EventTypes>>(
    event: T,
    ...args: EventEmitter3.EventArgs<EventTypes, T>
  ): Promise<boolean> {
    // Get all listeners for this event
    const listeners = this.listeners(event)
    // Wrap all listeners in Promises so we can wait for them all to complete
    const promises = listeners.map(
      listener =>
        // We need to wrap it in a new Promise to be able to wait for it to complete
        new Promise((resolve, reject) => {
          try {
            const result = listener(...(args as any))
            resolve(result)
          } catch (error) {
            reject(error)
          }
        })
    )
    // Wait for all Promises to complete
    await Promise.all(promises)
    // Return a boolean indicating whether any listeners handled this event
    return promises.length > 0
  }
}
export const emitter = new EventEmitter()
