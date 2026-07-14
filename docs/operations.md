# Operations Checklist

- Terminate TLS at a reverse proxy or managed load balancer.
- Generate a long random `JWT_SECRET`.
- Store `.env` outside source control.
- Back up PostgreSQL off-server daily.
- Restore a backup into a clean environment every month.
- Use a commercial-safe map tile provider before production.
- Keep Mosquitto anonymous access disabled in production and connect an auth plugin or broker adapter.
- Monitor API readiness, broker availability, database disk, CPU, memory and failed push attempts.
- Run dependency patching monthly.
- Load test before exceeding 100 Starter customers or 300 connected devices.
