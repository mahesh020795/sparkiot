import { Bell, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { NotificationItem } from "../lib/types";

export function NotificationsPage({ initialItems = [] }: { initialItems?: NotificationItem[] }) {
  const [items, setItems] = useState<NotificationItem[]>(initialItems);
  useEffect(() => {
    if (initialItems.length === 0) api.notifications().then(setItems);
  }, [initialItems.length]);
  async function testPush() {
    const created = await api.createNotification("Manual notification", "Push notification pipeline is connected.");
    setItems([created, ...items]);
  }
  return (
    <section className="panel notification-inbox">
      <div className="panel-title">
        <Bell size={18} />
        <div><span className="section-kicker">Notification inbox</span><h2>Notifications</h2></div>
        <button onClick={testPush}><Send size={16} />Test</button>
      </div>
      {items.length === 0 ? (
        <div className="empty-state">
          <div>
            <strong>No notifications yet</strong>
            <p>Push events, threshold alerts and manual tests will appear here with readable timestamps.</p>
          </div>
        </div>
      ) : items.map((item) => <div className="notification" key={item.id}><strong>{item.title}</strong><p>{item.body}</p><small>{new Date(item.created_at).toLocaleString()}</small></div>)}
    </section>
  );
}
