# cousin-harris

[![build status](https://circleci.com/gh/insidewhy/cousin-harris.png?style=shield)](https://circleci.com/gh/insidewhy/cousin-harris)
[![Known Vulnerabilities](https://snyk.io/test/github/insidewhy/cousin-harris/badge.svg)](https://snyk.io/test/github/insidewhy/cousin-harris)
[![Renovate](https://img.shields.io/badge/renovate-enabled-brightgreen.svg)](https://renovatebot.com)

## Usage

```typescript
import cousinHarris from 'cousin-harris'
import delay from 'delay'

const roots = ['dir1', 'dir2']
// resolves to a function to stop the watch after the watch has been setup
const stop = await cousinHarris(
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
// stop watching after one second
await delay(1000)
await stop()
```

Without `{ watchProject: true }` watchman's `watch` command is used instead of `watch-project`.
