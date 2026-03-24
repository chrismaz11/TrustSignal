## Engine Internal

This package is the current boundary for code that is intended to move to a
private verification engine repository or service.

It may expose:
- verification orchestration
- proof and receipt signing helpers
- scoring, screening, and anchoring internals

Public gateway code should not import `packages/core` internals directly.
Route handlers should depend on a narrow engine interface instead.
