import type { LoginBody, MeResponse, SignupBody } from '@audience/shared';
import { loginBodySchema, signupBodySchema } from '@audience/shared';
import { compare, hash } from 'bcryptjs';
import type { CookieOptions } from 'express';
import jwt from 'jsonwebtoken';
import { loadEnv } from '../config/env.js';
import { toUserDto, toWorkspaceDto } from '../db/mappers.js';
import { UniqueViolationError, type Repo } from '../db/repo.js';
import { HttpError } from '../utils/httpError.js';

/** bcrypt cost 12 (§14). Tests use 4 so the suite stays fast; never lowered elsewhere. */
const BCRYPT_COST = process.env.NODE_ENV === 'test' ? 4 : 12;

export const SESSION_COOKIE = 'session';
const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;
const DEV_JWT_SECRET = 'dev-only-insecure-jwt-secret';

const EMAIL_TAKEN = 'An account with this email already exists. Log in instead.';
const BAD_LOGIN = 'Email or password is wrong.';

function jwtSecret(): string {
  const env = loadEnv();
  if (env.JWT_SECRET) return env.JWT_SECRET;
  // loadEnv() already refuses to start production without JWT_SECRET.
  return DEV_JWT_SECRET;
}

export function sessionCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: loadEnv().NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS * 1000,
  };
}

export function signSession(userId: string): string {
  return jwt.sign({}, jwtSecret(), {
    subject: userId,
    expiresIn: SESSION_TTL_SECONDS,
    algorithm: 'HS256',
  });
}

/** The user id in a valid session token, or null. */
export function verifySession(token: string): string | null {
  try {
    const payload = jwt.verify(token, jwtSecret(), { algorithms: ['HS256'] });
    return typeof payload === 'object' && typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}

// Compared against when the email doesn't exist, so a wrong email takes as long as a wrong password.
let dummyHash: Promise<string> | undefined;
const getDummyHash = () => (dummyHash ??= hash('not-a-real-password', BCRYPT_COST));

/** Creates the user, their workspace (with the browser's timezone) and the owner membership. */
export async function signup(repo: Repo, input: SignupBody): Promise<MeResponse> {
  const body = signupBodySchema.parse(input);
  if (await repo.findUserByEmail(body.email)) throw new HttpError(409, EMAIL_TAKEN);

  const passwordHash = await hash(body.password, BCRYPT_COST);
  let user;
  try {
    user = await repo.createUser({
      email: body.email,
      password_hash: passwordHash,
      name: body.name,
    });
  } catch (err) {
    if (err instanceof UniqueViolationError) throw new HttpError(409, EMAIL_TAKEN);
    throw err;
  }

  // No transactions over the REST API: undo the earlier inserts if a later one fails.
  let workspaceId: string | undefined;
  try {
    const firstName = body.name.split(/\s+/)[0] ?? body.name;
    const workspace = await repo.createWorkspace({
      name: `${firstName}'s workspace`,
      timezone: body.timezone,
    });
    workspaceId = workspace.id;
    await repo.addMember({ workspace_id: workspace.id, user_id: user.id, role: 'owner' });
    return { user: toUserDto(user), workspace: toWorkspaceDto(workspace, 'owner') };
  } catch (err) {
    if (workspaceId) await repo.deleteWorkspace(workspaceId).catch(() => undefined);
    await repo.deleteUser(user.id).catch(() => undefined);
    throw err;
  }
}

export async function login(repo: Repo, input: LoginBody): Promise<MeResponse> {
  const body = loginBodySchema.parse(input);
  const user = await repo.findUserByEmail(body.email);
  const matches = await compare(body.password, user?.password_hash ?? (await getDummyHash()));
  if (!user || !matches) throw new HttpError(401, BAD_LOGIN);

  const me = await loadMe(repo, user.id);
  if (!me) throw new HttpError(401, BAD_LOGIN);
  return me;
}

/** The signed-in user with their workspace and role, or null if either is gone. */
export async function loadMe(repo: Repo, userId: string): Promise<MeResponse | null> {
  const [user, membership] = await Promise.all([
    repo.findUserById(userId),
    repo.findMembershipForUser(userId),
  ]);
  if (!user || !membership) return null;
  const workspace = await repo.findWorkspaceById(membership.workspace_id);
  if (!workspace) return null;
  return { user: toUserDto(user), workspace: toWorkspaceDto(workspace, membership.role) };
}
