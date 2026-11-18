export async function ensureAutumn(prisma) {
  const existing = await prisma.season.count()
  if (existing === 0) {
    await prisma.season.create({
      data: {
        name: 'Осень 2026',
        startsOn: new Date('2026-09-01'),
        endsOn: new Date('2026-11-30'),
        status: 'OPEN',
      },
    })
  }
  return prisma.season.findMany({ orderBy: { startsOn: 'asc' } })
}
