export interface AuthUser {
  id: string;
  email?: string | null;
  name?: string | null;
  email_verified?: boolean;
  email_confirmed_at?: string | null;
}

export interface AuthSession {
  user: AuthUser;
}
