import { NotImplementedError } from '../utils/httpError.js';

// TODO(Phase 1, §10, §14): signup, login, bcrypt (cost 12), JWT sign/verify, cookie options
export async function signup(_input: {
  email: string;
  password: string;
  name: string;
}): Promise<never> {
  throw new NotImplementedError(1);
}

export async function login(_input: { email: string; password: string }): Promise<never> {
  throw new NotImplementedError(1);
}
