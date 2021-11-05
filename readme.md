# cousin-harris

[![build status](https://circleci.com/gh/insidewhy/cousin-harris.png?style=shield)](https://circleci.com/gh/insidewhy/cousin-harris)
[![Known Vulnerabilities](https://snyk.io/test/github/insidewhy/cousin-harris/badge.svg)](https://snyk.io/test/github/insidewhy/cousin-harris)
[![Renovate](https://img.shields.io/badge/renovate-enabled-brightgreen.svg)](https://renovatebot.com)

## Usage

```typescript
import cousinHarris from 'cousin-harris'
import delay from 'delay'

const roots = ['dir1', 'dir2']
const watcher = cousinHarris(
  roots,
  ({ root, path, removal, isDirectory }) => {
    console.log(
      '%s %s at root %s was %s',
      isDirectory ? 'directory' : 'file',
      path,
      root,
      removal ? 'removed' : 'changed',
    )
  },
  { watchProject: true },
)

// wait for all watches to be initialised
await watcher.waitForWatches

// add more watches after a second
await delay(1000)
await watcher.addRoot('dir3')
await watcher.waitForWatches

// stop watching one second after setting up watch for 'dir3'
await delay(1000)
await watcher.stop()
```

Without `{ watchProject: true }` watchman's `watch` command is used instead of `watch-project`.

The `root` passed to the update function will be an absolute path, if it's important to receive the same `root` as was passed then the result of `fs.realPath` or equivalent should be passed to `cousinHarris`.
