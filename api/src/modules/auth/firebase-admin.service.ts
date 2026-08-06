import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { App, AppOptions, cert, getApps, initializeApp } from 'firebase-admin/app';
import { Auth, DecodedIdToken, getAuth } from 'firebase-admin/auth';

import { formatFirebasePrivateKey } from '../../config/firebase-private-key';

@Injectable()
export class FirebaseAdminService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FirebaseAdminService.name);
  private app: App | null = null;
  private auth: Auth | null = null;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    const projectId = this.configService.get<string>('firebase.projectId');
    const clientEmail = this.configService.get<string>('firebase.clientEmail');
    const privateKeyRaw = this.configService.get<string>('firebase.privateKey');
    const privateKey = formatFirebasePrivateKey(privateKeyRaw);

    if (!projectId || !clientEmail || !privateKey) {
      this.logger.warn(
        'Firebase Admin not configured (need FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY). Protected routes will return 503 until set.',
      );
      return;
    }

    const options: AppOptions = {
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    };

    this.app =
      getApps().length > 0 ? getApps()[0]! : initializeApp(options);
    this.auth = getAuth(this.app);
    this.logger.log(`Firebase Admin initialized for project ${projectId}`);
  }

  onModuleDestroy(): void {
    // firebase-admin apps are process-scoped; nothing to tear down per Nest lifecycle.
  }

  isReady(): boolean {
    return this.auth !== null;
  }

  async verifyIdToken(idToken: string): Promise<DecodedIdToken> {
    if (!this.auth) {
      throw new ServiceUnavailableException(
        'Firebase Auth is not configured on the server',
      );
    }

    return this.auth.verifyIdToken(idToken, true);
  }
}
