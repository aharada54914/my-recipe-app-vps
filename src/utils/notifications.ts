export interface LocalNotificationPayload {
  title: string
  body?: string
  tag?: string
}

export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

export function getNotificationPermission(): NotificationPermission {
  if (!isNotificationSupported()) return 'denied'
  return Notification.permission
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isNotificationSupported()) return 'denied'
  return Notification.requestPermission()
}

export async function showLocalNotification(payload: LocalNotificationPayload): Promise<boolean> {
  if (!isNotificationSupported()) return false
  if (Notification.permission !== 'granted') return false

  try {
    new Notification(payload.title, {
      body: payload.body,
      tag: payload.tag,
    })
    return true
  } catch {
    return false
  }
}
