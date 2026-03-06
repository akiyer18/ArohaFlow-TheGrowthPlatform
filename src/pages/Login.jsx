import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { isLocalMode } from '../config/supabase';
import { ArrowRight } from 'lucide-react';
import { Button, Input } from '../components/ui';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await login(email, password);
      if (result.success) {
        navigate('/dashboard');
      } else {
        setError(result.error || 'Failed to login');
      }
    } catch (err) {
      setError('Failed to login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="mx-auto flex min-h-[80vh] w-full max-w-md items-center">
        <div className="w-full rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur-xl p-8 shadow-2xl">
          <div className="mb-8 text-center">
            <img src="/logo.png" alt="Aroha Flow" className="mx-auto h-12 w-auto" />
            <h1 className="mt-6 text-[1.75rem]">Sign in</h1>
            <p className="mt-2 app-muted">
              New here?{' '}
              <Link to="/register" className="text-app-accent hover:underline">
                Create an account
              </Link>
            </p>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <label className="block">
              <span className="mb-1.5 block text-xs app-muted">Email or username</span>
              <Input
                id="email-address"
                name="email"
                type={isLocalMode ? 'text' : 'email'}
                autoComplete={isLocalMode ? 'username' : 'email'}
                required
                placeholder={isLocalMode ? 'Username or email' : 'Email address'}
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
                autoComplete="current-password"
                required
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>

            {error && (
              <div className="rounded-ui border border-rose-800 bg-rose-900/30 px-3 py-2 text-sm text-rose-300">
                {error}
              </div>
            )}

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? 'Signing in...' : 'Sign in'}
              {!loading ? <ArrowRight className="h-4 w-4" /> : null}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login; 