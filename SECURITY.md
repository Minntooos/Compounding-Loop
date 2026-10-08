# Security policy

## Reporting a vulnerability

Please report privately through GitHub's "Report a vulnerability" button on the Security tab of the repository, not in a public issue. Include steps to reproduce and the version (`loop --version`). You will get an acknowledgement as soon as a maintainer sees it.

## What the tool does and does not do

- The dashboard binds to loopback only and rejects requests whose `Host` or `Origin` is not loopback.
- Write requests need `Content-Type: application/json`.
- The tool never stores or logs tokens. GitHub access uses your own environment or `gh`.
- Child processes are started with an argument array, never a shell string.
- There is no telemetry and no call home.

## Supported versions

Only the latest published release receives fixes.
