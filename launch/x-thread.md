# X thread draft

1/ I let Claude Code build five live sites while I wasn't watching: 215 pages, 2,125 passing tests, 464 commits. The interesting part is what kept it honest. A thread.

2/ Rule one: the agent never says it's done. The task file lists done-when as commands. If `npm test` is red, the work doesn't count.

3/ Rule two: a second agent that didn't write the code reviews every diff before it's pushed. "Find the three most likely ways this is wrong for a real user."

4/ Rule three: runs can't overlap (session lock), can't run forever (run budget), and when stuck they write BLOCKED.md instead of guessing. You answer from an inbox.

5/ Everything it learns goes into a small indexed knowledge base, marked CONFIRMED or GUESS, so run 40 starts smarter than run 4.

6/ It's open source, MIT, no telemetry. CLI + local dashboard + templates + Claude Code plugin. Demo on the real data: `npx compounding-loop dashboard --demo`
https://github.com/Minntooos/compounding-loop
