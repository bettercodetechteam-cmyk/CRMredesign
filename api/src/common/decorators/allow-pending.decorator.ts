import { SetMetadata } from '@nestjs/common';

export const ALLOW_PENDING_KEY = 'allowPending';

/** Allow authenticated users who are not yet approved (e.g. /auth/me for onboarding). */
export const AllowPending = () => SetMetadata(ALLOW_PENDING_KEY, true);
