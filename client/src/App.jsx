import { useEffect, useState } from 'react';
import axios from 'axios';
import './App.css';

const API_URL =
  import.meta.env.VITE_API_URL ||
  'http://localhost:5000';

function App() {
  const [longUrl, setLongUrl] = useState('');
  const [shortUrl, setShortUrl] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState('');
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState('login');

  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user');

    return saved ? JSON.parse(saved) : null;
  });

  const [token, setToken] = useState(() => {
    return localStorage.getItem('token');
  });

  const [dashboard, setDashboard] = useState([]);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [authError, setAuthError] = useState('');

  const [freeLinksUsed, setFreeLinksUsed] =
    useState(() => {
      return Number(
        localStorage.getItem('freeLinksUsed') || 0
      );
    });

  useEffect(() => {
    if (user) {
      loadDashboard();
    }
  }, [user]);

  async function loadDashboard() {
    try {
      const response = await axios.get(
        `${API_URL}/api/urls/${user.id}`
      );

      setDashboard(response.data);
    } catch (error) {
      console.error(error);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setError('');
    setShortUrl('');
    setCopied(false);

    if (!user && freeLinksUsed >= 2) {
      setShowAuth(true);
      setAuthMode('login');

      setError(
        'You have used your 2 free links. Login or sign up to continue.'
      );

      return;
    }

    setLoading(true);

    try {
      const response = await axios.post(
        `${API_URL}/api/shorten`,
        {
          longUrl,
          userId: user?.id || null,
        },
        {
          withCredentials: true,
        }
      );

      setShortUrl(response.data.shortUrl);
      setLongUrl('');

      if (!user) {
        const newCount = freeLinksUsed + 1;

        setFreeLinksUsed(newCount);

        localStorage.setItem(
          'freeLinksUsed',
          newCount
        );
      }

      if (user) {
        loadDashboard();
      }
    } catch (err) {
      if (
        err.response?.data?.error ===
        'FREE_LIMIT_REACHED'
      ) {
        setShowAuth(true);
        setAuthMode('login');
      }

      setError(
        err.response?.data?.message ||
        err.response?.data?.error ||
        'Something went wrong'
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleAuth(event) {
    event.preventDefault();

    setAuthError('');

    try {
      const endpoint =
        authMode === 'login'
          ? '/api/login'
          : '/api/signup';

      const body =
        authMode === 'login'
          ? {
            email,
            password,
          }
          : {
            name,
            email,
            password,
          };

      const response = await axios.post(
        `${API_URL}${endpoint}`,
        body
      );

      localStorage.setItem(
        'token',
        response.data.token
      );

      localStorage.setItem(
        'user',
        JSON.stringify(response.data.user)
      );

      setToken(response.data.token);
      setUser(response.data.user);

      setShowAuth(false);

      setName('');
      setEmail('');
      setPassword('');

      setError('');
    } catch (err) {
      setAuthError(
        err.response?.data?.error ||
        'Authentication failed'
      );
    }
  }

  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');

    setToken(null);
    setUser(null);
    setDashboard([]);
  }

  async function copyShortUrl() {
    await navigator.clipboard.writeText(shortUrl);

    setCopied(true);

    setTimeout(() => {
      setCopied(false);
    }, 2000);
  }
  async function shareUrl(url, shortCode) {
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Short URL',
          text: 'Check out this link',
          url: url,
        });
      } else {
        await navigator.clipboard.writeText(url);

        setToast(shortCode);

        setTimeout(() => {
          setToast('');
        }, 2000);
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Share failed:', error);
      }
    }
  }
  async function deleteUrl(code) {
    try {
      await axios.delete(
        `${API_URL}/api/shorten/${code}`,
        {
          data: {
            userId: user.id,
          },
        }
      );

      loadDashboard();
    } catch (error) {
      console.error(error);
    }
  }

  return (
    <div className="app">
      <header className="navbar">
        <div className="logo">
          short<span>.</span>
        </div>

        <div className="nav-right">
          {user ? (
            <>
              <span className="user-name">
                {user.name}
              </span>

              <button
                className="ghost-button"
                onClick={logout}
              >
                Log out
              </button>
            </>
          ) : (
            <button
              className="ghost-button"
              onClick={() => {
                setAuthMode('login');
                setShowAuth(true);
              }}
            >
              Log in
            </button>
          )}
        </div>
      </header>

      <main>
        <section className="hero">
          <div className="hero-label">
            SIMPLE · FAST · FREE
          </div>

          <h1>
            Make your links
            <br />
            <span>shorter.</span>
          </h1>

          <p className="hero-text">
            Turn long URLs into clean, shareable links
            in seconds.
          </p>

          <form
            className="shorten-form"
            onSubmit={handleSubmit}
          >
            <input
              type="url"
              placeholder="Paste your long URL..."
              value={longUrl}
              onChange={(event) =>
                setLongUrl(event.target.value)
              }
              required
            />

            <button
              type="submit"
              disabled={loading}
            >
              {loading ? 'Shortening...' : 'Shorten'}
            </button>
          </form>

          {!user && (
            <div className="free-counter">
              {freeLinksUsed < 2
                ? `${2 - freeLinksUsed} free ${2 - freeLinksUsed === 1
                  ? 'link'
                  : 'links'
                } remaining`
                : 'Free limit reached'}
            </div>
          )}

          {error && (
            <div className="message error">
              {error}
            </div>
          )}

          {shortUrl && (
            <div className="result-card">
              <div>
                <div className="result-label">
                  YOUR SHORT LINK
                </div>

                <a
                  href={shortUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  {shortUrl}
                </a>
              </div>

              <button
                className="copy-button"
                onClick={copyShortUrl}
              >
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          )}
        </section>

        {user && (
          <section className="dashboard">
            <div className="section-heading">
              <div>
                <div className="hero-label">
                  YOUR LINKS
                </div>

                <h2>Dashboard</h2>
              </div>

              <span className="link-count">
                {dashboard.length}{' '}
                {dashboard.length === 1
                  ? 'link'
                  : 'links'}
              </span>
            </div>

            <div className="url-list">
              {dashboard.length === 0 ? (
                <div className="empty-state">
                  Your shortened links will appear here.
                </div>
              ) : (
                dashboard.map((url) => (
                  <div
                    className="url-row"
                    key={url._id}
                  >
                    <div className="url-info">
                      <a
                        className="short-url"
                        href={`${API_URL}/${url.shortCode}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {API_URL}/{url.shortCode}
                      </a>

                      <div className="original-url">
                        {url.longUrl}
                      </div>
                    </div>

                    <div className="url-stats">
                      <span>
                        {url.clicks} clicks
                      </span>

                      <div className="share-wrapper">
                        <button
                          className="share-button"
                          onClick={() =>
                            shareUrl(
                              `${API_URL}/${url.shortCode}`,
                              url.shortCode
                            )
                          }
                        >
                          Share
                        </button>

                        {toast === url.shortCode && (
                          <div className="toast">
                            Link copied to clipboard!
                          </div>
                        )}
                      </div>
                      <button
                        className="delete-button"
                        onClick={() =>
                          deleteUrl(url.shortCode)
                        }
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        )}
      </main>

      <footer>
        <span>short.</span>

        <span>
          {user
            ? 'Your links, your dashboard.'
            : '2 free links. No account required.'}
        </span>
      </footer>

      {showAuth && (
        <div
          className="modal-backdrop"
          onClick={() => setShowAuth(false)}
        >
          <div
            className="auth-modal"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <button
              className="modal-close"
              onClick={() => setShowAuth(false)}
            >
              ×
            </button>

            <div className="hero-label">
              {authMode === 'login'
                ? 'WELCOME BACK'
                : 'GET STARTED'}
            </div>

            <h2>
              {authMode === 'login'
                ? 'Log in'
                : 'Create an account'}
            </h2>

            <p className="auth-description">
              {authMode === 'login'
                ? 'Continue shortening unlimited links.'
                : 'Create an account to keep shortening links.'}
            </p>

            <form
              className="auth-form"
              onSubmit={handleAuth}
            >
              {authMode === 'signup' && (
                <input
                  type="text"
                  placeholder="Name"
                  value={name}
                  onChange={(event) =>
                    setName(event.target.value)
                  }
                  required
                />
              )}

              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(event) =>
                  setEmail(event.target.value)
                }
                required
              />

              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(event) =>
                  setPassword(event.target.value)
                }
                required
              />

              {authError && (
                <div className="message error">
                  {authError}
                </div>
              )}

              <button type="submit">
                {authMode === 'login'
                  ? 'Log in'
                  : 'Create account'}
              </button>
            </form>

            <button
              className="switch-auth"
              onClick={() => {
                setAuthError('');

                setAuthMode(
                  authMode === 'login'
                    ? 'signup'
                    : 'login'
                );
              }}
            >
              {authMode === 'login'
                ? "Don't have an account? Sign up"
                : 'Already have an account? Log in'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;