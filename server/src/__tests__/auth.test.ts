import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { getProxyIdentity, createAuthMiddleware, createUIAuthMiddleware } from '../middleware/auth.js';
import type { ServerConfig } from '../config.js';

describe('auth middleware', () => {
  describe('getProxyIdentity', () => {
    let mockReq: Partial<Request>;
    const authHeaders = {
      username: 'X-Auth-Request-User',
      groups: 'X-Auth-Request-Groups',
      email: 'X-Auth-Request-Email',
      name: 'X-Auth-Request-Name',
      uid: 'X-Auth-Request-UID',
    };

    beforeEach(() => {
      mockReq = {
        header: vi.fn(),
      };
    });

    it('should extract basic identity from headers', () => {
      const headerFn = mockReq.header as any;
      headerFn.mockImplementation((name: string) => {
        const headers: Record<string, string> = {
          'X-Auth-Request-User': 'alice',
          'X-Auth-Request-Groups': 'admin,users',
          'X-Auth-Request-Email': 'alice@example.com',
          'X-Auth-Request-Name': 'Alice Smith',
          'X-Auth-Request-UID': '12345',
        };
        return headers[name];
      });

      const identity = getProxyIdentity(mockReq as Request, authHeaders);

      expect(identity.username).toBe('alice');
      expect(identity.groups).toEqual(['admin', 'users']);
      expect(identity.email).toBe('alice@example.com');
      expect(identity.name).toBe('Alice Smith');
      expect(identity.uid).toBe('12345');
    });

    it('should handle missing headers gracefully', () => {
      const headerFn = mockReq.header as any;
      headerFn.mockReturnValue(undefined);

      const identity = getProxyIdentity(mockReq as Request, authHeaders);

      expect(identity.username).toBeUndefined();
      expect(identity.groups).toEqual([]);
      expect(identity.email).toBeUndefined();
      expect(identity.name).toBeUndefined();
      expect(identity.uid).toBeUndefined();
    });

    it('should ignore empty header values', () => {
      const headerFn = mockReq.header as any;
      headerFn.mockImplementation((name: string) => {
        if (name === 'X-Auth-Request-User') return '  ';
        return undefined;
      });

      const identity = getProxyIdentity(mockReq as Request, authHeaders);
      expect(identity.username).toBeUndefined();
    });

    it('should parse groups as comma-separated values', () => {
      const headerFn = mockReq.header as any;
      headerFn.mockImplementation((name: string) => {
        if (name === 'X-Auth-Request-Groups') return 'admin, users, developers';
        return undefined;
      });

      const identity = getProxyIdentity(mockReq as Request, authHeaders);
      expect(identity.groups).toEqual(['admin', 'users', 'developers']);
    });

    it('should parse groups as semicolon-separated values', () => {
      const headerFn = mockReq.header as any;
      headerFn.mockImplementation((name: string) => {
        if (name === 'X-Auth-Request-Groups') return 'admin;users;developers';
        return undefined;
      });

      const identity = getProxyIdentity(mockReq as Request, authHeaders);
      expect(identity.groups).toEqual(['admin', 'users', 'developers']);
    });

    it('should parse groups as JSON array', () => {
      const headerFn = mockReq.header as any;
      headerFn.mockImplementation((name: string) => {
        if (name === 'X-Auth-Request-Groups') return '["admin","users","developers"]';
        return undefined;
      });

      const identity = getProxyIdentity(mockReq as Request, authHeaders);
      expect(identity.groups).toEqual(['admin', 'users', 'developers']);
    });

    it('should fall back to delimited parsing for invalid JSON', () => {
      const headerFn = mockReq.header as any;
      headerFn.mockImplementation((name: string) => {
        if (name === 'X-Auth-Request-Groups') return '[invalid,json';
        return undefined;
      });

      const identity = getProxyIdentity(mockReq as Request, authHeaders);
      expect(identity.groups).toEqual(['[invalid', 'json']);
    });

    it('should filter empty strings from groups', () => {
      const headerFn = mockReq.header as any;
      headerFn.mockImplementation((name: string) => {
        if (name === 'X-Auth-Request-Groups') return 'admin,,users,  ,developers';
        return undefined;
      });

      const identity = getProxyIdentity(mockReq as Request, authHeaders);
      expect(identity.groups).toEqual(['admin', 'users', 'developers']);
    });
  });

  describe('createAuthMiddleware', () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let mockNext: NextFunction;
    const config: ServerConfig = {
      port: 3001,
      rawBasePath: '',
      normalizedBasePath: '',
      apiPrefix: '/api',
      requireAuth: true,
      authHeaders: {
        username: 'x-forwarded-user',
        groups: 'x-forwarded-groups',
        email: 'x-forwarded-email',
        name: 'x-forwarded-name',
        uid: 'x-forwarded-uid',
      },
    };

    beforeEach(() => {
      mockReq = {
        header: vi.fn(),
        path: '/api/jobs',
      };
      mockRes = {
        locals: {},
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
      };
      mockNext = vi.fn();
    });

    it('should allow requests to /health endpoint', () => {
      mockReq.path = '/health';
      const middleware = createAuthMiddleware(config);

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should allow requests to /auth/me endpoint', () => {
      mockReq.path = '/auth/me';
      const middleware = createAuthMiddleware(config);

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should return 401 when auth required but not provided', () => {
      const headerFn = mockReq.header as any;
      headerFn.mockReturnValue(undefined);
      
      const middleware = createAuthMiddleware(config);
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Authentication required.' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 403 when group requirement not met', () => {
      const configWithGroup: ServerConfig = {
        ...config,
        requireAuthGroup: 'admin',
      };
      
      const headerFn = mockReq.header as any;
      headerFn.mockImplementation((name: string) => {
        if (name === 'x-forwarded-user') return 'alice';
        if (name === 'x-forwarded-groups') return 'users';
        return undefined;
      });

      const middleware = createAuthMiddleware(configWithGroup);
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({ error: "Access requires membership in group 'admin'." });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should allow when group requirement is met', () => {
      const configWithGroup: ServerConfig = {
        ...config,
        requireAuthGroup: 'admin',
      };
      
      const headerFn = mockReq.header as any;
      headerFn.mockImplementation((name: string) => {
        if (name === 'x-forwarded-user') return 'alice';
        if (name === 'x-forwarded-groups') return 'users,admin';
        return undefined;
      });

      const middleware = createAuthMiddleware(configWithGroup);
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should allow when auth not required', () => {
      const configNoAuth: ServerConfig = {
        ...config,
        requireAuth: false,
      };
      
      const middleware = createAuthMiddleware(configNoAuth);
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should attach identity to res.locals', () => {
      const configNoAuth: ServerConfig = {
        ...config,
        requireAuth: false,
      };
      
      const headerFn = mockReq.header as any;
      headerFn.mockImplementation((name: string) => {
        if (name === 'x-forwarded-user') return 'alice';
        if (name === 'x-forwarded-groups') return 'admin,users';
        return undefined;
      });

      const middleware = createAuthMiddleware(configNoAuth);
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.locals?.identity).toBeDefined();
      expect(mockRes.locals?.identity.username).toBe('alice');
      expect(mockRes.locals?.identity.groups).toEqual(['admin', 'users']);
    });
  });

  describe('createUIAuthMiddleware', () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let mockNext: NextFunction;
    const config: ServerConfig = {
      port: 3001,
      rawBasePath: '',
      normalizedBasePath: '',
      apiPrefix: '/api',
      requireAuth: true,
      authHeaders: {
        username: 'x-forwarded-user',
        groups: 'x-forwarded-groups',
        email: 'x-forwarded-email',
        name: 'x-forwarded-name',
        uid: 'x-forwarded-uid',
      },
    };

    beforeEach(() => {
      mockReq = {
        header: vi.fn(),
        path: '/',
      };
      mockRes = {
        locals: {},
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
      };
      mockNext = vi.fn();
    });

    it('should return 401 for UI when auth required but not provided', () => {
      const headerFn = mockReq.header as any;
      headerFn.mockReturnValue(undefined);
      
      const middleware = createUIAuthMiddleware(config);
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should allow UI access when auth not required', () => {
      const configNoAuth: ServerConfig = {
        ...config,
        requireAuth: false,
      };
      
      const middleware = createUIAuthMiddleware(configNoAuth);
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });
});
