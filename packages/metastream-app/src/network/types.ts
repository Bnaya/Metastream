/** Wrapper around social user IDs. */
import { EventEmitter } from 'events'

export type ReplicatedState<T extends { [key: string]: any }> = {
  [key in keyof T]?: boolean | ReplicatedState<T[keyof T]>
}
