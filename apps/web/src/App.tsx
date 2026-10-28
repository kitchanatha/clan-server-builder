import { useCallback, useEffect, useState } from 'react';
import type { Lang } from '@csb/shared';
import { api, type GuildSummary, type Me } from './api';
import { ui } from './i18n';
import { Builder } from './Builder';

function useLang(): [Lang, (l: Lang) => void] {
  const [lang, setLang] = useState<Lang>(() => {
    try {
      return (localStorage.getItem('csb-lang') as Lang) || 'th';
    } catch {
      return 'th';
    }
  });
  useEffect(() => {
    document.documentElement.lang = lang;
    try {
      localStorage.setItem('csb-lang', lang);
    } catch {
      /* storage unavailable */
    }
  }, [lang]);
  return [lang, setLang];
}

export function App() {
  const [lang, setLang] = useLang();
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const [guilds, setGuilds] = useState<GuildSummary[] | null>(null);
  const [selected, setSelected] = useState<string | null>(() => new URLSearchParams(location.search).get('guild'));
  const loginFailed = new URLSearchParams(location.search).get('login') === 'failed';

  const loadGuilds = useCallback(() => {
    setGuilds(null);
    api.guilds().then(setGuilds).catch(() => setGuilds([]));
  }, []);

  useEffect(() => {
    api
      .me()
      .then((m) => {
        setMe(m);
        loadGuilds();
      })
      .catch(() => setMe(null));
  }, [loadGuilds]);

  const choose = (id: string | null) => {
    setSelected(id);
    const url = new URL(location.href);
    if (id) url.searchParams.set('guild', id);
    else url.searchParams.delete('guild');
    url.searchParams.delete('login');
    history.replaceState(null, '', url);
  };

  return (
    <div className="wrap">
      <header className="top">
        <div className="brand">
          <div className="mark">CB</div>
          <div>
            <h1>Clan Server Builder</h1>
            <small>{ui(lang, 'tagline')}</small>
          </div>
        </div>
        <div className="top-right">
          <div className="lang" role="group" aria-label="Language">
            <button aria-pressed={lang === 'th'} onClick={() => setLang('th')}>ไทย</button>
            <button aria-pressed={lang === 'en'} onClick={() => setLang('en')}>EN</button>
          </div>
          {me && (
            <div className="user">
              {me.avatar && <img src={me.avatar} alt="" width={28} height={28} />}
              <span>{me.username}</span>
              <button
                className="link"
                onClick={() => api.logout().finally(() => location.assign('/'))}
              >
                {ui(lang, 'signOut')}
              </button>
            </div>
          )}
        </div>
      </header>

      {me === undefined && <p className="muted">{ui(lang, 'loading')}</p>}

      {me === null && (
        <section className="hero">
          <h2>{ui(lang, 'heroTitle')}</h2>
          <p>{ui(lang, 'heroBody')}</p>
          {loginFailed && <p className="error">{ui(lang, 'loginFailed')}</p>}
          <a className="btn" href="/auth/login">{ui(lang, 'signIn')}</a>
        </section>
      )}

      {me && !selected && (
        <section className="step">
          <div className="step-head">
            <h2>{ui(lang, 'pickServer')}</h2>
            <button className="btn ghost small" onClick={loadGuilds}>{ui(lang, 'refresh')}</button>
          </div>
          <p className="hint">{ui(lang, 'pickServerHint')}</p>
          {guilds === null ? (
            <p className="muted">{ui(lang, 'loading')}</p>
          ) : (
            <div className="servers">
              {guilds.map((g) => (
                <button key={g.id} className="server" onClick={() => choose(g.id)}>
                  {g.icon ? <img src={g.icon} alt="" width={40} height={40} /> : <span className="server-init">{g.name.slice(0, 2)}</span>}
                  <span className="server-name">{g.name}</span>
                  <span className={`pill ${g.botInstalled ? 'ok' : ''}`}>{ui(lang, g.botInstalled ? 'botOn' : 'botOff')}</span>
                </button>
              ))}
            </div>
          )}
          <div className="note">
            <b>{ui(lang, 'noServer')}</b> {ui(lang, 'noServerBody')}
          </div>
        </section>
      )}

      {me && selected && <Builder guildId={selected} lang={lang} onBack={() => { choose(null); loadGuilds(); }} />}
    </div>
  );
}
