import { ensureDir, mkdir, remove, writeFile, unlink } from 'fs-extra'
import { sortBy } from 'lodash'
import { join as pathJoin } from 'path'
import waitForExpect from 'wait-for-expect'

import cousinHarris, { CousinHarrisChange, CousinHarrisWatcher } from '.'

describe('cousinHarris', () => {
  const BASE_DIR = pathJoin(__dirname, 'dirs')
  let watcher: CousinHarrisWatcher | undefined
  let root = ''
  let otherRoot = ''
  let events: CousinHarrisChange[] = []

  beforeAll(async () => {
    await ensureDir(BASE_DIR)
  })

  afterAll(async () => {
    await remove(BASE_DIR)
  })

  beforeEach(async () => {
    events = []
    await createRoot()
  })

  const startWatching = async () => {
    watcher = cousinHarris([root], (event) => events.push(event))
    await watcher.waitForWatches
  }

  afterEach(async () => {
    await watcher?.stop()
    watcher = undefined
  })

  const randomDirectoryPath = () =>
    pathJoin(BASE_DIR, Math.floor(Math.random() * 10_000_000).toString())

  const createRoot = async () => {
    root = randomDirectoryPath()
    await mkdir(root)
  }

  const createOtherRoot = async () => {
    otherRoot = randomDirectoryPath()
    await mkdir(otherRoot)
  }

  const expectEvents = async (expected: CousinHarrisChange[]) =>
    waitForExpect(() => {
      // watchman doesn't report events in order so sort them by path
      expect(sortBy(events, 'path')).toEqual(sortBy(expected, 'path'))
    })

  it('can watch a directory for file changes', async () => {
    await startWatching()
    writeFile(pathJoin(root, 'first'), 'stuff')
    writeFile(pathJoin(root, 'second'), 'stuff')
    await expectEvents([
      { root, path: 'first', removal: false, isDirectory: false },
      { root, path: 'second', removal: false, isDirectory: false },
    ])
  })

  it('can watch a directory for file removals', async () => {
    await startWatching()
    await writeFile(pathJoin(root, 'remove'), 'stuff')
    await expectEvents([{ root, path: 'remove', removal: false, isDirectory: false }])
    unlink(pathJoin(root, 'remove'))
    await expectEvents([
      { root, path: 'remove', removal: false, isDirectory: false },
      { root, path: 'remove', removal: true, isDirectory: false },
    ])
  })

  it('can add root after initial root', async () => {
    await startWatching()
    writeFile(pathJoin(root, 'first'), 'stuff')
    const firstEvent = { root, path: 'first', removal: false, isDirectory: false }
    await expectEvents([firstEvent])
    await createOtherRoot()
    watcher?.addRoot(otherRoot)
    await watcher?.waitForWatches
    writeFile(pathJoin(otherRoot, 'second'), 'stuff')
    await expectEvents([
      firstEvent,
      { root: otherRoot, path: 'second', removal: false, isDirectory: false },
    ])
  })
})
