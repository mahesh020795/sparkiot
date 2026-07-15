self.addEventListener("push", (event) => {
  let payload = {
    title: "Spark IoT Alert",
    body: "A Spark IoT notification was received.",
    created_at: new Date().toISOString()
  };

  if (event.data) {
    try {
      payload = { ...payload, ...event.data.json() };
    } catch {
      payload.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title || "Spark IoT Alert", {
      body: payload.body || "A Spark IoT notification was received.",
      data: {
        notificationId: payload.id,
        createdAt: payload.created_at,
        url: "/"
      },
      badge: "/favicon.ico",
      icon: "/favicon.ico",
      tag: payload.id || "spark-iot-notification"
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});
