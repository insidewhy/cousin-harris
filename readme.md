# cousin-harris

[![build status](https://circleci.com/gh/insidewhy/cousin-harris.png?style=shield)](https://circleci.com/gh/insidewhy/cousin-harris)
[![Known Vulnerabilities](https://snyk.io/test/github/insidewhy/cousin-harris/badge.svg)](https://snyk.io/test/github/insidewhy/cousin-harris)
[![Renovate](https://img.shields.io/badge/renovate-enabled-brightgreen.svg)](https://renovatebot.com)

## Usage

```typescript
import cousinHarris from 'cousin-harris'

const roots = ['dir1', 'dir2']
cousinHarris(
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
```

Without `{ watchProject: true }` watchman's `watch` command is used instead of `watch-project`.
