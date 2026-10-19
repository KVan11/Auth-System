export interface User {
  id: number;
  email: string;
  username: string;
  role: string;
  permissions?: string[];
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse extends AuthTokens {
  message: string;
  /** @deprecated alias của accessToken, giữ để tương thích */
  token?: string;
  user: User;
}
