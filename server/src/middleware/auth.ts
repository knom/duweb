import type { Request, NextFunction, Response } from 'express';

export interface ProxyIdentity {
  username?: string;
  groups: string[];
  email?: string;
  name?: string;
  uid?: string;
}

export const REQUIRE_AUTH = process.env.REQUIRE_AUTH === 'true';

export const authHeaders = {
  username: process.env.AUTH_HEADER_USERNAME ?? 'x-forwarded-user',
  groups:   process.env.AUTH_HEADER_GROUPS   ?? 'x-forwarded-groups',
  email:    process.env.AUTH_HEADER_EMAIL    ?? 'x-forwarded-email',
  name:     process.env.AUTH_HEADER_NAME     ?? 'x-forwarded-name',
  uid:      process.env.AUTH_HEADER_UID      ?? 'x-forwarded-uid',
};

function readHeader(req: Request, name: string): string | undefined {
  const value = req.header(name);
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

function parseGroups(rawGroups: string | undefined): string[] {
  if (!rawGroups) {
    return [];
  }

  if (rawGroups.startsWith('[')) {
    try {
      const parsed = JSON.parse(rawGroups) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.filter((item): item is string => typeof item === 'string' && item.trim() !== '');
      }
    } catch {
      // Fall back to delimited parsing below.
    }
  }

  return rawGroups
    .split(/[,;]+/)
    .map((value) => value.trim())
    .filter((value) => value !== '');
}

export function getProxyIdentity(req: Request): ProxyIdentity {
  const username = readHeader(req, authHeaders.username);
  const groupsHeader = readHeader(req, authHeaders.groups);
  const groups = parseGroups(groupsHeader);
  const email = readHeader(req, authHeaders.email);
  const name = readHeader(req, authHeaders.name);
  const uid = readHeader(req, authHeaders.uid);

  const identity: ProxyIdentity = { groups };
  if (username) {
    identity.username = username;
  }
  if (email) {
    identity.email = email;
  }
  if (name) {
    identity.name = name;
  }
  if (uid) {
    identity.uid = uid;
  }

  return identity;
}

export function createAuthMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const identity = getProxyIdentity(req);
    res.locals.identity = identity;

    if (REQUIRE_AUTH && (!identity.username || identity.groups.length === 0)) {
      console.warn(`[Auth] Rejected unauthenticated request from ${req.ip} to ${req.method} ${req.path}`);
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }

    if (identity.username) {
      console.debug(`[Auth] Authenticated: ${identity.username} (groups: ${identity.groups.join(', ') || 'none'})`);
    }

    next();
  };
}
