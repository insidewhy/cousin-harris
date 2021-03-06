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

// returns a promise that can be used to cancel the watches
function cousinHarris(
  roots: string[],
  onChange: OnCousinHarrisChange,
  options: CousinHarrisOptions = {},
): Promise<() => Promise<void>> {
  const client = new Client()

  return new Promise<() => Promise<void>>(async (resolve, reject) => {
    const stopPromise = new Promise<void>((resolveStop) => {
      client.on('end', resolveStop)
    })

    client.on('subscription', ({ root, files }) => {
      if (!files) {
        // watchman... why
        return
      }

      files.forEach(({ name, exists, type }: FileChange) => {
        const isDirectory = type === 'd'
        if (exists) {
          if (isDirectory) {
            // ignore directory changes
            return
          }

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

    await Promise.all(
      roots.map(
        async (root) =>
          new Promise<void>(async (resolveWatch) => {
            const fullSrcDir = await realpath(root)
            client.command(
              [options.watchProject ? 'watch-project' : 'watch', fullSrcDir],
              async (error, watchResp) => {
                if (error) {
                  await removeWatches()
                  endAndReject(`Could not initiate watch: ${error.message}`)
                  return
                }

                watchedRoots.push(fullSrcDir)

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
          }),
      ),
    )

    let runCleanup = false
    resolve(async () => {
      if (!runCleanup) {
        runCleanup = true
        await removeWatches()
        client.end()
      }
      await stopPromise
    })
  })
}

export default cousinHarris
