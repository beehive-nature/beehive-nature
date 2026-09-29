# Accepted observer package: release integration

Astra imported z1.c's reviewed `9557aaeb` runbook, observer, local canary
suite and four dispatches into a clean worktree from `8d42da28`.
The observer scripts are byte-identical to the accepted candidate. Historical
dispatches carry supersession notices so retracted claims are not current
guidance. z1.c's original branch remains intact.

The existing static CI job now runs the 50-test observer suite. It uses local
fixtures and never contacts production. The accepted source was independently
tested by Astra (50/50); integration validation and remote checks are recorded
on the release PR. No deployed file, systemd unit, node, storage allocation,
or network rule changes. An installed version is still not an enforced pin;
upgrade-hold testing, capacity/recovery and upstream field evidence remain open.
