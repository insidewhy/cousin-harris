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

// returns a promise that never resolves
function cousinHarris(
  roots: string[],
  onChange: OnCousinHarrisChange,
  options: CousinHarrisOptions = {},
): Promise<() => Promise<void>> {
  const client = new Client()

  return new Promise<() => Promise<void>>((resolve, reject) => {
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

    client.capabilityCheck({ optional: [], required: ['relative_root'] }, async (error) => {
      const endAndReject = (message: string) => {
        client.end()
        reject(new Error(message))
      }

      if (error) {
        return endAndReject(`Could not confirm capabilities: ${error.message}`)
      }

      roots.map(async (root) => {
        const fullSrcDir = await realpath(root)
        client.command(
          [options.watchProject ? 'watch-project' : 'watch', fullSrcDir],
          (error, watchResp) => {
            if (error) {
              return endAndReject(`Could not initiate watch: ${error.message}`)
            }

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const sub: any = {
              expression: ['allof', ['match', '*']],
              fields: ['name', 'exists', 'type'],
            }
            const relativePath = watchResp.relative_path
            if (relativePath) {
              sub.relative_root = relativePath
            }

            client.command(['subscribe', watchResp.watch, 'sub-name', sub], (error) => {
              if (error) {
                return endAndReject(`Could not subscribe to changes: ${error.message}`)
              }

              resolve(() => {
                client.end()
                return stopPromise
              })
            })
          },
        )
      })
    })
  })
}

export default cousinHarris
