import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { isLocalMode } from '../config/supabase';
import { ArrowRight } from 'lucide-react';
import { Button, Input } from '../components/ui';

const Register = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!isLocalMode && password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (!isLocalMode && password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      const result = await register(email, password, confirmPassword, name);
      if (result.success) {
        if (result.message) {
          // Email confirmation required
          setSuccess(result.message);
        } else {
          // Direct login (no email confirmation required)
          navigate('/dashboard');
        }
      } else {
        setError(result.error || 'Failed to register');
      }
    } catch (err) {
      setError('Failed to register');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="mx-auto flex min-h-[80vh] w-full max-w-md items-center">
        <div className="w-full rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur-xl p-8 shadow-2xl">
          <div className="mb-8 text-center">
            <img src="/logo.png" alt="Productive Calendar" className="mx-auto h-12 w-auto" />
            <h1 className="mt-6 text-[1.75rem]">Create account</h1>
            <p className="mt-2 app-muted">
              Have an account?{' '}
              <Link to="/login" className="text-app-accent hover:underline">
                Sign in
              </Link>
            </p>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <label className="block">
              <span className="mb-1.5 block text-xs app-muted">Full name (optional)</span>
              <Input
                id="name"
                name="name"
                type="text"
                autoComplete="name"
                placeholder="Full Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs app-muted">Email</span>
              <Input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs app-muted">Password</span>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs app-muted">Confirm password</span>
              <Input
                id="confirm-password"
                name="confirm-password"
                type="password"
                autoComplete="new-password"
                required
                placeholder="Confirm Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </label>

            {error && (
              <div className="rounded-ui border border-rose-800 bg-rose-900/30 px-3 py-2 text-sm text-rose-300">
                {error}
              </div>
            )}

            {success && (
              <div className="rounded-ui border border-emerald-800 bg-emerald-900/30 px-3 py-2 text-sm text-emerald-300">
                {success}
              </div>
            )}

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? 'Creating account...' : 'Create account'}
              {!loading ? <ArrowRight className="h-4 w-4" /> : null}
            </Button>

            {success && (
              <div className="text-center">
                <Link to="/login" className="text-sm text-app-accent hover:underline">
                  Continue to login
                </Link>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};

export default Register; 