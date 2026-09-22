self.addEventListener("push", function (event) {
  if (!event.data) return;
  
  let payload = {};
  try {
    payload = event.data.json();
  } catch (e) {
    console.error("Kunde inte parsa push-data", e);
  }

  const title = payload.title || "SportMonitor";
  
  // Vi letar efter URL antingen inuti 'data' eller direkt på payloaden
  const targetUrl = (payload.data && payload.data.url) ? payload.data.url : (payload.url || "/");

  const options = {
    body: payload.body || "",
    icon: "/favicon.png",
    badge: "/favicon.png",
    data: {
      url: targetUrl
    }
  };

  if (payload.tag) {
    options.tag = payload.tag;
  }

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();

  // Plocka ut URL:en som vi sparade i 'data' när notisen skapades
  const urlToOpen = event.notification.data?.url || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // Om användaren redan har den exakta artikeln öppen, hoppa till den fliken
      for (const client of clientList) {
        if (client.url === urlToOpen && "focus" in client) {
          return client.focus();
        }
      }
      // Annars: Tvinga upp en helt ny flik/fönster med nyhetsartikeln!
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});