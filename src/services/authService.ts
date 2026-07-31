import { apiClient, mockDelay } from './apiClient';
import type { User } from '../types';

/**
 * Decodes the payload of a Google ID token (JWT) without verifying the
 * signature — Google's Identity Services SDK already verified it before
 * handing us the credential. We just need the user-info claims.
 */
function decodeGoogleCredential(credential: string): {
  sub: string;
  name: string;
  email: string;
  picture?: string;
} {
  const [, payload] = credential.split('.');
  // Base64url → Base64 → JSON (with unicode support)
  const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.length % 4;
  const padded = pad ? base64 + '='.repeat(4 - pad) : base64;
  const json = decodeURIComponent(escape(atob(padded)));
  return JSON.parse(json) as { sub: string; name: string; email: string; picture?: string };
}

interface BackendUser {
  _id: string;
  googleId: string;
  email: string;
  name: string;
  picture?: string;
  phone?: string;
  bloodGroup?: string;
  medicalNotes?: string;
}

export function toFrontendUser(user: BackendUser): User {
  return {
    id: user._id,
    googleId: user.googleId,
    name: user.name,
    email: user.email,
    avatarUrl: user.picture,
    phone: user.phone,
    bloodGroup: user.bloodGroup,
    medicalNotes: user.medicalNotes,
  };
}

export const authService = {
  /**
   * Accepts the real Google ID-token credential from @react-oauth/google,
   * decodes it client-side, then syncs the already-authenticated user to MongoDB.
   */
  async loginWithGoogle(credential: string): Promise<{ token: string; user: User }> {
    const claims = decodeGoogleCredential(credential);
    const { data } = await apiClient.post<{ user: BackendUser }>('/auth/google', {
      googleId: claims.sub,
      name: claims.name,
      email: claims.email,
      picture: claims.picture,
    });
    const user = toFrontendUser(data.user);

    localStorage.setItem('tether_token', credential);
    return { token: credential, user };
  },

  async loginAsGuest(): Promise<{ token: string; user: User }> {
    const { data } = await apiClient.post<{ user: BackendUser }>('/auth/guest');
    const token = `guest:${data.user._id}`;
    localStorage.setItem('tether_token', token);
    return { token, user: toFrontendUser(data.user) };
  },

  async logout(): Promise<void> {
    await mockDelay(undefined, 300);
    localStorage.removeItem('tether_token');
  },
};
