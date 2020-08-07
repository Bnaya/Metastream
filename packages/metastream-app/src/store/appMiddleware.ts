import { Middleware } from 'redux'

import { netRpcMiddleware } from 'network/middleware/rpc'
import { netSyncMiddleware } from 'network/middleware/sync'
import { usersMiddleware } from 'lobby/middleware/users'
import { sessionMiddleware, SessionObserver } from 'lobby/middleware/session'
import { pwaMiddleware } from '../middleware/pwa'
import { MediaSessionObserver } from '../lobby/mediaSessionObserver'
import { mediaSessionMiddleware } from '../lobby/middleware/mediaSession'
import { ConfigureStoreOptions } from './types'

export const configureAppMiddleware = (opts: ConfigureStoreOptions) => {
  const list: (Middleware | undefined)[] = [
    netRpcMiddleware({ extra: opts.extra }),
    netSyncMiddleware(),
    usersMiddleware(),
    sessionMiddleware([new MediaSessionObserver()]),
    pwaMiddleware(),
    mediaSessionMiddleware()
  ]

  const middleware = list.filter(Boolean) as Middleware[]
  return middleware
}
