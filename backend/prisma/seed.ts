import { PrismaClient, MediaType, TitleStatus, TitleSource } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('password123', 10);
  const user = await prisma.user.upsert({
    where: { email: 'demo@example.com' },
    update: {},
    create: {
      email: 'demo@example.com',
      passwordHash,
      displayName: 'Demo User',
      onboardingCompleted: true,
    },
  });

  const demoTitle = await prisma.title.upsert({
    where: { tmdbId: 550 },
    update: {},
    create: {
      tmdbId: 550,
      mediaType: MediaType.movie,
      originalTitle: 'Fight Club',
      russianTitle: 'Бойцовский клуб',
      overview: 'Demo title placeholder',
      posterPath: null,
      backdropPath: null,
      releaseDate: new Date('1999-10-15'),
      runtime: 139,
      tmdbRating: 8.4,
      genres: ['Drama'],
      countries: ['US'],
      originalLanguage: 'en',
      rawTmdbJson: {},
    },
  });

  await prisma.userTitleState.upsert({
    where: { userId_titleId: { userId: user.id, titleId: demoTitle.id } },
    update: {},
    create: {
      userId: user.id,
      titleId: demoTitle.id,
      status: TitleStatus.watched,
      source: TitleSource.manual,
      liked: true,
      rating: 10,
    },
  });

  console.log('Seed completed');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
