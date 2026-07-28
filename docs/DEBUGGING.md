# Systematic debugging and incident prevention

1. Start with the client-visible symptom and capture the correlation ID.
2. Check API request logs for validation or persistence failures.
3. Inspect `/metrics` for error-rate, p95-latency, provider-failure and queue-backlog changes.
4. Query the command row and inspect `status`, `attempt_count`, `last_error` and timestamps.
5. Check whether the provider circuit is `closed`, `open` or `half-open`.
6. Reproduce with the deterministic OEM simulator and a known failure mode.
7. Classify the root cause as client input, platform bug, database issue, transient provider failure or permanent provider rejection.
8. Add or update an automated test that reproduces the issue before applying the fix.
9. Add monitoring or an alert when the failure mode can be detected earlier.
10. Record the long-term prevention action rather than stopping at a one-off retry.

This playbook is designed around debugging, monitoring, reliability enhancements and preventing recurring problems.
