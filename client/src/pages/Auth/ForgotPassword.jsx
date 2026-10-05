import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { KeyRound, CheckCircle, ArrowLeft } from 'lucide-react';
import api from '../../services/api';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [devToken, setDevToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/auth/forgot-password', { email });
      setSubmitted(true);
      if (res.data.data?.devToken) {
        setDevToken(res.data.data.devToken);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to dispatch reset email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-2xl p-8 shadow-2xl">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center p-3 bg-blue-600/10 text-blue-500 rounded-2xl mb-2">
            <KeyRound className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-black text-white">Reset Password</h2>
          <p className="text-xs text-slate-400 mt-1">We'll dispatch a 30-minute security reset token</p>
        </div>

        {submitted ? (
          <div className="p-6 bg-blue-500/10 border border-blue-500/30 rounded-2xl text-center space-y-3">
            <CheckCircle className="w-10 h-10 text-blue-400 mx-auto" />
            <h3 className="text-sm font-bold text-blue-300">Reset Token Dispatched</h3>
            <p className="text-xs text-slate-300">Check your inbox for password reset instructions.</p>
            {devToken && (
              <div className="p-3 bg-slate-800 rounded-xl text-left border border-slate-700">
                <p className="text-[10px] text-slate-400 font-bold uppercase">Dev Copy Token:</p>
                <p className="text-xs font-mono text-amber-400 break-all">{devToken}</p>
                <Link to={`/reset-password?token=${devToken}`} className="inline-block mt-2 text-xs text-blue-400 font-bold hover:underline">
                  Go to Reset Page with Token &rarr;
                </Link>
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs">{error}</div>}

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase mb-2">Your Registered Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@sdmas.com"
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs transition-all disabled:opacity-50"
            >
              {loading ? 'Sending Reset Token...' : 'Dispatch Reset Email'}
            </button>
          </form>
        )}

        <div className="mt-6 text-center">
          <Link to="/login" className="inline-flex items-center text-xs text-slate-400 hover:text-white font-semibold">
            <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
