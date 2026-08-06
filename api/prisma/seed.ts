/**
 * Dev seed — creates one centre + one staff user for auth testing.
 *
 * Usage:
 *   set SEED_FIREBASE_UID=your_firebase_uid
 *   set SEED_EMAIL=you@example.com
 *   npm run prisma:seed
 *
 * Get firebase uid from Firebase Console → Authentication → Users,
 * or from the client after login: auth.currentUser.uid
 */
import 'dotenv/config';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, UserRole } from '@prisma/client';

const firebaseUid = process.env.SEED_FIREBASE_UID?.trim();
const email = process.env.SEED_EMAIL?.trim() ?? 'director@zica.edu';
const firstName = process.env.SEED_FIRST_NAME?.trim() ?? 'Director';
const lastName = process.env.SEED_LAST_NAME?.trim() ?? 'User';

async function main(): Promise<void> {
  if (!firebaseUid) {
    throw new Error(
      'Set SEED_FIREBASE_UID to a real Firebase Auth uid before seeding.',
    );
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
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

    const user = await prisma.user.upsert({
      where: { firebaseUid },
      update: {
        email,
        firstName,
        lastName,
        role: UserRole.director,
        centreId: centre.id,
        approved: true,
        isActive: true,
      },
      create: {
        firebaseUid,
        email,
        firstName,
        lastName,
        role: UserRole.director,
        centreId: centre.id,
        approved: true,
        isActive: true,
      },
    });

    console.log('Seeded centre:', centre.code, centre.id);
    console.log('Seeded user:', user.email, user.id, `(firebase ${user.firebaseUid})`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
