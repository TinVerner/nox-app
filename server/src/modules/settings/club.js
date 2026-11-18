import { prisma } from '../../shared/prisma.js'

export async function clubSettings() {
  const defaults = {
    club_name: { value: 'NOX', description: 'Название клуба' },
    booking_open: { value: true, description: 'Запись открыта' },
    waitlist_size: { value: 4, description: 'Размер листа ожидания' },
  }
  const rows = await prisma.appSetting.findMany()
  const map = new Map(rows.map((row) => [row.settingKey, row.settingValue]))
  for (const [key, item] of Object.entries(defaults)) {
    if (map.has(key)) continue
    await prisma.appSetting.create({
      data: { settingKey: key, settingValue: item.value, description: item.description },
    })
    map.set(key, item.value)
  }
  return {
    name: String(map.get('club_name') ?? 'NOX'),
    bookingOpen: map.get('booking_open') !== false,
    waitlistSize: Number(map.get('waitlist_size') ?? 4),
  }
}
