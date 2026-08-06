import 'dotenv/config';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

async function main(): Promise<void> {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL as string }),
  });

  try {
    const centre = await prisma.centre.upsert({
      where: { code: 'PUNE' },
      update: { name: 'Pune Centre', isActive: true },
      create: {
        code: 'PUNE',
        name: 'Pune Centre',
        city: 'Pune',
        state: 'Maharashtra',
        isActive: true,
      },
    });

    const course = await prisma.course.upsert({
      where: { code: 'WD' },
      update: {
        name: 'Web Development',
        rollPrefix: 'WD',
        durationMonths: 6,
        isActive: true,
      },
      create: {
        name: 'Web Development',
        code: 'WD',
        rollPrefix: 'WD',
        durationMonths: 6,
        fees: 45000,
        category: 'Development',
        isActive: true,
      },
    });

    console.log(JSON.stringify({ centreId: centre.id, courseId: course.id }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
