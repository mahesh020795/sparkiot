import { Bell, CheckCheck, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { NotificationItem } from "../lib/types";

export function NotificationsPage({ initialItems = [], accountMode = false }: { initialItems?: NotificationItem[]; accountMode?: boolean }) {
  const [items, setItems] = useState<NotificationItem[]>(initialItems);
  useEffect(() => {
    if (initialItems.length === 0) api.notifications().then(setItems);
  }, [initialItems.length]);
  async function testPush() {
    const created = await api.createNotification("Manual notification", "Push notification pipeline is connected.");
    setItems([created, ...items]);
  }
  async function markRead(item: NotificationItem) {
    const updated = accountMode ? await api.markNotificationRead(item.id) : { ...item, read: true };
    setItems((current) => current.map((entry) => entry.id === item.id ? updated : entry));
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
      ) : items.map((item) => (
        <div className={`notification ${item.read ? "read" : "unread"}`} key={item.id}>
          <div className="notification-head">
            <strong>{item.title}</strong>
            <span className={`notification-state ${item.read ? "read" : "unread"}`}>{item.read ? "Read" : "Unread"}</span>
          </div>
          <p>{item.body}</p>
          <div className="notification-footer">
            <small>{new Date(item.created_at).toLocaleString()}</small>
            {!item.read && (
              <button type="button" onClick={() => void markRead(item)} aria-label={`Mark ${item.title} as read`}>
                <CheckCheck size={15} />Mark read
              </button>
            )}
          </div>
        </div>
      ))}
    </section>
  );
}
