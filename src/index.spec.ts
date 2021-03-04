import { mkdir, remove, writeFile, unlink } from 'fs-extra'
import { join as pathJoin } from 'path'
import waitForExpect from 'wait-for-expect'

import cousinHarris, { CousinHarrisChange } from '.'

describe('cousinHarris', () => {
  const BASE_DIR = pathJoin(__dirname, 'dirs')
  let stop = () => Promise.resolve()
  let root = ''
  let events = new Set<CousinHarrisChange>()

  beforeAll(async () => {
    await mkdir(BASE_DIR)
  })

  afterAll(async () => {
    await remove(BASE_DIR)
  })

  beforeEach(async () => {
    events = new Set()
    await makeDirectory()
  })

  const startWatching = async () => {
    stop = await cousinHarris([root], (event) => events.add(event))
  }

  afterEach(async () => {
    await stop()
  })

  const makeDirectory = async () => {
    root = pathJoin(BASE_DIR, Math.floor(Math.random() * 10_000_000).toString())
    await mkdir(root)
  }

  const expectEvents = async (expected: CousinHarrisChange[]) =>
    waitForExpect(() => {
      expect(events).toEqual(new Set(expected))
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
})
