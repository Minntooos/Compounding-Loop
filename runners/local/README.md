# Local runner

Runs the loop from your own machine on a schedule. Needs Node 20+, git and the `claude` CLI signed in to your account.

- **Linux:** paste the line from `crontab.txt` into `crontab -e` and set your repository path. Prefer systemd? Copy `compounding-loop.service` and `compounding-loop.timer` to `~/.config/systemd/user/`, set `WorkingDirectory`, and enable the timer (commands at the top of the service file); it also runs missed rounds after sleep.
- **macOS:** `crontab.txt` works too, but launchd is the native scheduler and runs missed rounds after sleep. Edit the paths in `launchd.plist` (`loop` from `which loop`, your repository, the log file), copy it to `~/Library/LaunchAgents/` and load it with the `launchctl bootstrap` line at the top of the file. The plist runs `loop run` hourly at minute 17.
- **Windows:** edit the path in `task-scheduler.xml`, then import it with `schtasks /Create /XML task-scheduler.xml /TN CompoundingLoop`. The `claude.exe` native build must be on your PATH. Add `--skip-permissions` to the task's arguments only in a repository you trust, so the unattended run can edit files.

Both use the minute `17`; change it so several loops do not start together. Each run is capped by the session lock (90 minutes) and the run budget (`Run: N / 30`).
