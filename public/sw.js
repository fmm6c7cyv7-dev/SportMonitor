self.addEventListener("push", function (event) {
  if (!event.data) return;

  let payload = {};
  try {
    payload = event.data.json();
    console.log("[SW] push payload:", payload);
  } catch (e) {
    console.error("[SW] Kunde inte parsa push-data", e);
  }

  const title = payload.title || "SportMonitor";

  const targetUrl =
    payload.data && payload.data.url
      ? payload.data.url
      : payload.url || "/";

  const options = {
    body: payload.body || "",
    icon: "/favicon.png",
    badge: "/favicon.png",
    data: {
      url: targetUrl,
      news_id:
        payload.data && payload.data.news_id
          ? payload.data.news_id
          : payload.news_id || null,
      source:
        payload.data && payload.data.source
          ? payload.data.source
          : payload.source || null,
      sport:
        payload.data && payload.data.sport
          ? payload.data.sport
          : payload.sport || null,
      title: title || null,
    },
  };

  if (payload.tag) {
    options.tag = payload.tag;
  }

  console.log("[SW] showNotification data:", options.data);

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();

  const notificationData = event.notification.data || {};
  const urlToOpen = notificationData.url || "/";

  console.log("[SW] notificationclick data:", notificationData);

  event.waitUntil(
    (async () => {
      try {
        const res = await fetch("/api/events", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            event_type: "push_open",
            news_id: notificationData.news_id || null,
            source: notificationData.source || null,
            sport: notificationData.sport || null,
            metadata: {
              url: notificationData.url || null,
              title: notificationData.title || null,
            },
          }),
        });

        const json = await res.json().catch(() => null);
        console.log("[SW] push_open response:", res.status, json);
      } catch (e) {
        console.error("[SW] Kunde inte logga push_open", e);
      }

      const clientList = await clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      for (const client of clientList) {
        if (client.url === urlToOpen && "focus" in client) {
          return client.focus();
        }
      }

      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })()
  );
});
