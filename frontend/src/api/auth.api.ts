import { http } from './client';
import type { LoginResponse, UserProfile } from './types';

export const authApi = {
  login: async (email: string, password: string): Promise<LoginResponse> =>
    (await http.post<LoginResponse>('/auth/login', { email, password })).data,

  me: async (): Promise<UserProfile> => (await http.get<UserProfile>('/auth/me')).data,
};
