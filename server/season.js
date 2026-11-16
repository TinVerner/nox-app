export async function ensureAutumn(prisma) {
  const existing = await prisma.season.count()
  if (existing === 0) {
    await prisma.season.create({ data: { name: 'Осень 2026', closed: false } })
  }
  const season = await prisma.season.findFirst({ where: { name: 'Осень 2026' } })
  if (season) {
    await prisma.game.updateMany({
      where: { seasonId: null },
      data: { seasonId: season.id },
    })
  }
  return prisma.season.findMany({ orderBy: { name: 'asc' } })
}
