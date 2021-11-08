import { Client } from 'fb-watchman'
import { realpath } from 'fs-extra'

export interface CousinHarrisChange {
  root: string
  path: string
  removal: boolean
  isDirectory: boolean
}

export type OnCousinHarrisChange = (change: CousinHarrisChange) => void

export interface CousinHarrisOptions {
  watchProject?: boolean
}

interface FileChange {
  name: string
  exists: boolean
  type: 'f' | 'd'
}

export interface CousinHarrisWatcher {
  // resolves after cousin harris has connected to watchman
  waitForWatchmanConnection: Promise<void>

  // resolves after cousin harris has connected to watchman and the initial
  // set of roots have been configured
  waitForWatches: Promise<void>

  // terminate the connection and stop watching
  stop(): Promise<void>

  // add a new watch root
  addRoot(root: string): void
}

const watchRoot = async (
  client: Client,
  addRoot: (root: string) => void,
  removeWatches: () => Promise<void[]>,
  options: CousinHarrisOptions,
  root: string,
) =>
  new Promise<void>(async (resolveWatch, reject) => {
    const endAndReject = (message: string) => {
      client.end()
      reject(new Error(message))
    }

    const fullSrcDir = await realpath(root)
    client.command(
      [options.watchProject ? 'watch-project' : 'watch', fullSrcDir],
      async (error, watchResp) => {
        if (error) {
          await removeWatches()
          endAndReject(`Could not initiate watch: ${error.message}`)
          return
        }

        addRoot(fullSrcDir)

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sub: any = {
          expression: ['allof', ['match', '*']],
          fields: ['name', 'exists', 'type'],
        }
        const relativePath = watchResp.relative_path
        if (relativePath) {
          sub.relative_root = relativePath
        }

        client.command(['subscribe', watchResp.watch, 'sub-name', sub], async (error) => {
          if (error) {
            await removeWatches()
            endAndReject(`Could not subscribe to changes: ${error.message}`)
          } else {
            resolveWatch()
          }
        })
      },
    )
  })

// returns a promise that can be used to cancel the watches
function cousinHarris(
  initialRoots: string[],
  onChange: OnCousinHarrisChange,
  options: CousinHarrisOptions = {},
): CousinHarrisWatcher {
  const client = new Client()

  let ended = false

  const watchedRoots: string[] = []
  const removeWatches = () =>
    Promise.all(
      watchedRoots.splice(0).map(
        (srcDir) =>
          new Promise<void>((resolve) => {
            client.command(['watch-del', srcDir], () => {
              resolve()
            })
          }),
      ),
    )

  const stopPromise = new Promise<void>((resolveStop) => {
    client.on('end', resolveStop)
  })

  const waitForWatchmanConnection = new Promise<void>(async (resolve, reject) => {
    client.on('subscription', ({ root, files }) => {
      if (!files) {
        // watchman... why
        return
      }

      files.forEach(({ name, exists, type }: FileChange) => {
        const isDirectory = type === 'd'
        if (exists) {
          onChange({ root, path: name, removal: false, isDirectory })
        } else {
          onChange({ root, path: name, removal: true, isDirectory })
        }
      })
    })

    const endAndReject = (message: string) => {
      client.end()
      reject(new Error(message))
    }

    await new Promise<void>((resolveCapabilityCheck) => {
      client.capabilityCheck({ optional: [], required: ['relative_root'] }, async (error) => {
        if (error) {
          endAndReject(`Could not confirm capabilities: ${error.message}`)
        } else {
          resolveCapabilityCheck()
        }
      })
    })

    resolve()
  })

  const watchRootImpl = watchRoot.bind(
    null,
    client,
    (root: string) => {
      watchedRoots.push(root)
    },
    removeWatches,
    options,
  )

  let nextRoots = initialRoots.length ? initialRoots : undefined
  // ensure it can't be false until waitForWatchmanConnection has resolved even if there
  // are no initialRoots
  let pendingWatchRoots = true
  const watchRootsUntilEmpty = async () => {
    while (nextRoots) {
      const roots = nextRoots
      nextRoots = undefined
      await Promise.all(roots.map(watchRootImpl))
    }
    pendingWatchRoots = false
  }

  const waitForWatches = waitForWatchmanConnection.then(watchRootsUntilEmpty)

  const watcher = {
    waitForWatchmanConnection,

    waitForWatches,

    stop: async () => {
      if (!ended) {
        ended = true
        await removeWatches()
        client.end()
      }
      await stopPromise
    },

    addRoot: (root: string) => {
      if (ended) {
        throw new Error('Cannot call addRoot(root) after stop()')
      } else if (pendingWatchRoots) {
        if (nextRoots) {
          nextRoots.push(root)
        } else {
          nextRoots = [root]
        }
      } else {
        pendingWatchRoots = true
        nextRoots = [root]
        watcher.waitForWatches = watchRootsUntilEmpty()
      }
    },
  }

  return watcher
}

export default cousinHarris
