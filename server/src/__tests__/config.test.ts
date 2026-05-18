import { describe, it, expect } from 'vitest';
import { ConfigLoader } from '../config.js';

describe('config', () => {
  describe('loadConfig', () => {
    it('should load default config when no env vars provided', () => {
      const config = ConfigLoader.loadConfig({});
      
      expect(config.port).toBe(3001);
      expect(config.rawBasePath).toBe('');
      expect(config.normalizedBasePath).toBe('');
      expect(config.apiPrefix).toBe('/api');
      expect(config.requireAuth).toBe(false);
      expect(config.requireAuthGroup).toBeUndefined();
    });

    it('should parse PORT env var', () => {
      const config = ConfigLoader.loadConfig({ PORT: '3000' });
      expect(config.port).toBe(3000);
    });

    it('should throw on invalid PORT', () => {
      expect(() => ConfigLoader.loadConfig({ PORT: '99999' })).toThrow('Invalid PORT value');
      expect(() => ConfigLoader.loadConfig({ PORT: '0' })).toThrow('Invalid PORT value');
      expect(() => ConfigLoader.loadConfig({ PORT: 'abc' })).toThrow('Invalid PORT value');
      expect(() => ConfigLoader.loadConfig({ PORT: '-1' })).toThrow('Invalid PORT value');
    });

    it('should parse BASE_PATH env var', () => {
      const config1 = ConfigLoader.loadConfig({ BASE_PATH: '/disk-usage' });
      expect(config1.rawBasePath).toBe('/disk-usage');
      expect(config1.normalizedBasePath).toBe('/disk-usage');
      expect(config1.apiPrefix).toBe('/disk-usage/api');

      const config2 = ConfigLoader.loadConfig({ BASE_PATH: 'disk-usage' });
      expect(config2.normalizedBasePath).toBe('/disk-usage');

      const config3 = ConfigLoader.loadConfig({ BASE_PATH: '/disk-usage/' });
      expect(config3.normalizedBasePath).toBe('/disk-usage');

      const config4 = ConfigLoader.loadConfig({ BASE_PATH: '//disk-usage//' });
      expect(config4.normalizedBasePath).toBe('/disk-usage');
    });

    it('should normalize empty BASE_PATH to root', () => {
      const config1 = ConfigLoader.loadConfig({ BASE_PATH: '' });
      expect(config1.normalizedBasePath).toBe('');
      expect(config1.apiPrefix).toBe('/api');

      const config2 = ConfigLoader.loadConfig({ BASE_PATH: '/' });
      expect(config2.normalizedBasePath).toBe('');
      expect(config2.apiPrefix).toBe('/api');
    });

    it('should parse REQUIRE_AUTH boolean', () => {
      const testCases = [
        { input: 'true', expected: true },
        { input: 'True', expected: true },
        { input: 'TRUE', expected: true },
        { input: '1', expected: true },
        { input: 'yes', expected: true },
        { input: 'on', expected: true },
        { input: 'false', expected: false },
        { input: 'False', expected: false },
        { input: 'FALSE', expected: false },
        { input: '0', expected: false },
        { input: 'no', expected: false },
        { input: 'off', expected: false },
      ];

      for (const { input, expected } of testCases) {
        const config = ConfigLoader.loadConfig({ REQUIRE_AUTH: input });
        expect(config.requireAuth).toBe(expected);
      }
    });

    it('should throw on invalid REQUIRE_AUTH value', () => {
      expect(() => ConfigLoader.loadConfig({ REQUIRE_AUTH: 'maybe' })).toThrow('Invalid boolean value');
      expect(() => ConfigLoader.loadConfig({ REQUIRE_AUTH: '2' })).toThrow('Invalid boolean value');
    });

    it('should parse REQUIRE_AUTH_GROUP when REQUIRE_AUTH is true', () => {
      const config = ConfigLoader.loadConfig({ REQUIRE_AUTH: 'true', REQUIRE_AUTH_GROUP: 'admin' });
      expect(config.requireAuthGroup).toBe('admin');
    });

    it('should throw if REQUIRE_AUTH_GROUP set without REQUIRE_AUTH', () => {
      expect(() => ConfigLoader.loadConfig({ REQUIRE_AUTH: 'false', REQUIRE_AUTH_GROUP: 'admin' })).toThrow(
        'REQUIRE_AUTH_GROUP requires REQUIRE_AUTH=true',
      );
    });

    it('should ignore REQUIRE_AUTH_GROUP if set to empty string', () => {
      const config = ConfigLoader.loadConfig({ REQUIRE_AUTH: 'true', REQUIRE_AUTH_GROUP: '  ' });
      expect(config.requireAuthGroup).toBeUndefined();
    });

    it('should parse custom auth header names', () => {
      const config = ConfigLoader.loadConfig({
        AUTH_HEADER_USERNAME: 'X-Remote-User',
        AUTH_HEADER_GROUPS: 'X-Remote-Groups',
        AUTH_HEADER_EMAIL: 'X-Remote-Email',
        AUTH_HEADER_NAME: 'X-Remote-Name',
        AUTH_HEADER_UID: 'X-Remote-UID',
      });

      expect(config.authHeaders.username).toBe('X-Remote-User');
      expect(config.authHeaders.groups).toBe('X-Remote-Groups');
      expect(config.authHeaders.email).toBe('X-Remote-Email');
      expect(config.authHeaders.name).toBe('X-Remote-Name');
      expect(config.authHeaders.uid).toBe('X-Remote-UID');
    });

    it('should use default auth header names when not provided', () => {
      const config = ConfigLoader.loadConfig({});
      expect(config.authHeaders.username).toBe('x-forwarded-user');
      expect(config.authHeaders.groups).toBe('x-forwarded-groups');
      expect(config.authHeaders.email).toBe('x-forwarded-email');
      expect(config.authHeaders.name).toBe('x-forwarded-name');
      expect(config.authHeaders.uid).toBe('x-forwarded-uid');
    });

    it('should throw if auth header name is empty', () => {
      expect(() => ConfigLoader.loadConfig({ AUTH_HEADER_USERNAME: '  ' })).toThrow('must not be empty');
    });

    it('should build complete config with all options', () => {
      const config = ConfigLoader.loadConfig({
        PORT: '4000',
        BASE_PATH: '/app',
        REQUIRE_AUTH: 'true',
        REQUIRE_AUTH_GROUP: 'users',
        REDIS_URL: 'redis://host:6379',
        AUTH_HEADER_USERNAME: 'X-User',
        AUTH_HEADER_GROUPS: 'X-Groups',
        AUTH_HEADER_EMAIL: 'X-Email',
        AUTH_HEADER_NAME: 'X-Name',
        AUTH_HEADER_UID: 'X-UID',
      });

      expect(config.port).toBe(4000);
      expect(config.normalizedBasePath).toBe('/app');
      expect(config.apiPrefix).toBe('/app/api');
      expect(config.requireAuth).toBe(true);
      expect(config.requireAuthGroup).toBe('users');
      expect(config.authHeaders.username).toBe('X-User');
    });
  });
});
