import { useGoogleLogin } from '@react-oauth/google';
import { motion } from 'framer-motion';
import { useState } from 'react';
import { FiArrowLeft, FiUser } from 'react-icons/fi';
import { Link, useNavigate } from 'react-router-dom';
import Button from '../../components/common/Button';
import TetherMark from '../../components/common/TetherMark';
import { useAuth } from '../../contexts/AuthContext';
import { useNotify } from '../../contexts/NotificationContext';

export default function LoginPage() {
  const { loginWithGoogle, loginAsGuest } = useAuth();
  const notify = useNotify();
  const navigate = useNavigate();
  const [pending, setPending] = useState<'google' | 'guest' | null>(null);

  const handleGoogle = useGoogleLogin({
    flow: 'implicit',
    onSuccess: async (tokenResponse) => {
      // Use the access_token to fetch the user's profile from Google's userinfo endpoint.
      try {
        const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
        });
        const profile = await res.json() as {
          sub: string;
          name: string;
          email: string;
          picture?: string;
        };
        // Encode the Google profile so authService can sync the authenticated user to MongoDB.
        const base64Payload = btoa(unescape(encodeURIComponent(JSON.stringify(profile))));
        const fakeCredential = `dummy.${base64Payload}.dummy`;
        await loginWithGoogle(fakeCredential);
        navigate('/dashboard');
      } catch (err) {
        console.error('Google sign in error:', err);
        notify('Google sign-in failed. Please try again.', 'warning');
        setPending(null);
      }
    },
    onError: () => {
      notify('Google sign-in was cancelled or failed.', 'warning');
      setPending(null);
    },
  });

  const handleGoogleClick = () => {
    setPending('google');
    handleGoogle();
  };

  const handleGuest = async () => {
    setPending('guest');
    await loginAsGuest();
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-16">
      <Link to="/" className="fixed top-6 left-6 flex items-center gap-2 text-sm text-sky-300 hover:text-sky-50 transition-colors">
        <FiArrowLeft /> Back home
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="w-full max-w-sm glass rounded-[var(--radius-xl3)] p-8 sm:p-10 text-center"
      >
        <div className="flex justify-center">
          <TetherMark size={52} />
        </div>
        <h1 className="mt-6 text-2xl font-medium text-sky-50 tracking-tight">Welcome back</h1>
        <p className="mt-2 text-sm text-sky-300/80">
          Sign in to keep your guardians close.
        </p>

        <div className="mt-8 flex flex-col gap-3">
          <Button
            variant="secondary"
            size="lg"
            fullWidth
            loading={pending === 'google'}
            onClick={handleGoogleClick}
            icon={<GoogleGlyph />}
          >
            Continue with Google
          </Button>
          <Button
            variant="ghost"
            size="lg"
            fullWidth
            loading={pending === 'guest'}
            onClick={handleGuest}
            icon={<FiUser />}
          >
            Continue as guest
          </Button>
        </div>

        <p className="mt-8 text-xs text-sky-400/60 leading-relaxed">
          By continuing, you agree to Tether's Terms and Privacy Notice.
        </p>
      </motion.div>
    </div>
  );
}

function GoogleGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48">
      <path fill="#EA4335" d="M24 9.5c3.4 0 6.4 1.2 8.8 3.5l6.6-6.6C35.5 2.6 30.1 0 24 0 14.6 0 6.5 5.4 2.5 13.2l7.7 6C12.1 13.1 17.6 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.6-4.9 7.3l7.5 5.8C43.9 37.9 46.5 31.8 46.5 24.5z" />
      <path fill="#FBBC05" d="M10.2 19.2c-.5 1.5-.8 3.1-.8 4.8s.3 3.3.8 4.8l-7.7 6C.9 31.5 0 28 0 24s.9-7.5 2.5-10.8l7.7 6z" />
      <path fill="#34A853" d="M24 48c6.1 0 11.3-2 15-5.5l-7.5-5.8c-2 1.4-4.6 2.2-7.5 2.2-6.4 0-11.9-4.3-13.8-10.1l-7.7 6C6.5 42.6 14.6 48 24 48z" />
    </svg>
  );
}
