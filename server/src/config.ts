export interface AuthHeaderConfig {
  username: string;
  groups: string;
  email: string;
  name: string;
  uid: string;
}

export interface ServerConfig {
  port: number;
  rawBasePath: string;
  normalizedBasePath: string;
  apiPrefix: string;
  requireAuth: boolean;
  requireAuthGroup?: string;
  authHeaders: AuthHeaderConfig;
}

export class ConfigLoader {
  static parseBoolean(value: string | undefined, fallback = false): boolean {
    if (value === undefined) {
      return fallback;
    }

    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) {
      return true;
    }
    if (['false', '0', 'no', 'off'].includes(normalized)) {
      return false;
    }

    throw new Error(`Invalid boolean value: ${value}`);
  }

  static parsePort(value: string | undefined): number {
    const parsed = Number(value ?? '3001');
    if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65535) {
      throw new Error(`Invalid PORT value: ${value ?? ''}`);
    }

    return parsed;
  }

  static normalizeBasePath(value: string | undefined): { rawBasePath: string; normalizedBasePath: string; apiPrefix: string } {
    const rawBasePath = value ?? '';
    const normalizedBasePath =
      rawBasePath === '' || rawBasePath === '/'
        ? ''
        : `/${rawBasePath.replace(/^\/+|\/+$/g, '')}`;

    return {
      rawBasePath,
      normalizedBasePath,
      apiPrefix: `${normalizedBasePath}/api`,
    };
  }

  static readHeaderName(value: string | undefined, fallback: string, envName: string): string {
    const resolved = (value ?? fallback).trim();
    if (resolved === '') {
      throw new Error(`${envName} must not be empty`);
    }

    return resolved;
  }

  static loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
    const requireAuth = this.parseBoolean(env.REQUIRE_AUTH, false);
    const requireAuthGroup = env.REQUIRE_AUTH_GROUP?.trim() || undefined;

    if (requireAuthGroup && !requireAuth) {
      throw new Error('REQUIRE_AUTH_GROUP requires REQUIRE_AUTH=true');
    }

    const { rawBasePath, normalizedBasePath, apiPrefix } = this.normalizeBasePath(env.BASE_PATH);

    const config: ServerConfig = {
      port: this.parsePort(env.PORT),
      rawBasePath,
      normalizedBasePath,
      apiPrefix,
      requireAuth,
      authHeaders: {
        username: this.readHeaderName(env.AUTH_HEADER_USERNAME, 'x-forwarded-user', 'AUTH_HEADER_USERNAME'),
        groups: this.readHeaderName(env.AUTH_HEADER_GROUPS, 'x-forwarded-groups', 'AUTH_HEADER_GROUPS'),
        email: this.readHeaderName(env.AUTH_HEADER_EMAIL, 'x-forwarded-email', 'AUTH_HEADER_EMAIL'),
        name: this.readHeaderName(env.AUTH_HEADER_NAME, 'x-forwarded-name', 'AUTH_HEADER_NAME'),
        uid: this.readHeaderName(env.AUTH_HEADER_UID, 'x-forwarded-uid', 'AUTH_HEADER_UID'),
      },
    };

    if (requireAuthGroup) {
      config.requireAuthGroup = requireAuthGroup;
    }

    return config;
  }
}