import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  FEATURES,
  GAMES,
  TEMPLATES,
  buildPlan,
  normalizeFeatures,
  type Access,
  type FeatureId,
  type GuildConfig,
  type Lang,
} from '@csb/shared';
import { api, type GuildDetail } from './api';
import { ui, type UiKey } from './i18n';
import { Customize } from './Customize';

const ACCESS_LABEL: Record<Access, UiKey | null> = {
  public: null,
  verified: 'afterRules',
  guild: 'membersOnly',
  staff: 'staffOnly',
};

const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

export function Builder({ guildId, lang, onBack }: { guildId: string; lang: Lang; onBack: () => void }) {
  const [detail, setDetail] = useState<GuildDetail | null>(null);
  const [config, setConfig] = useState<GuildConfig | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [waitingForBot, setWaitingForBot] = useState(false);
  const loaded = useRef(false);

  const load = () =>
    api.guild(guildId).then((d) => {
      setDetail(d);
      if (!loaded.current) {
        setConfig(d.config);
        loaded.current = true;
      }
      return d;
    });

  useEffect(() => {
    load().catch((e: Error) => setMessage({ kind: 'error', text: e.message }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guildId]);

  // Poll while the bot is joining or building.
  const busy = detail && (detail.provisionStatus === 'queued' || detail.provisionStatus === 'running');
  useEffect(() => {
    if (!busy && !waitingForBot) return;
    const id = setInterval(() => {
      load()
        .then((d) => {
          if (d.botInstalled) setWaitingForBot(false);
        })
        .catch(() => undefined);
    }, 3000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy, waitingForBot]);

  const plan = useMemo(() => (config ? buildPlan(config) : null), [config]);

  if (!detail || !config || !plan) {
    return (
      <section className="step">
        <button className="link" onClick={onBack}>{ui(lang, 'back')}</button>
        <p className={message?.kind === 'error' ? 'error' : 'muted'}>{message?.text ?? ui(lang, 'loading')}</p>
      </section>
    );
  }

  const update = (patch: Partial<GuildConfig>) => {
    setConfig({ ...config, ...patch });
    setDirty(true);
    setMessage(null);
  };

  const toggle = (id: FeatureId) => {
    const on = new Set(config.features);
    if (on.has(id)) on.delete(id);
    else on.add(id);
    update({ features: normalizeFeatures([...on]) });
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.saveConfig(guildId, config);
      setDirty(false);
      setMessage({ kind: 'ok', text: ui(lang, 'saved') });
      await load();
    } catch (e) {
      setMessage({ kind: 'error', text: (e as Error).message });
    } finally {
      setSaving(false);
    }
  };

  const channelsByCat = plan.categories.map((c) => ({
    ...c,
    channels: plan.channels.filter((ch) => ch.category === c.key),
  }));
  const status = detail.provisionStatus;

  return (
    <div className="grid">
      <main className="col">
        <button className="link" onClick={onBack}>{ui(lang, 'back')}</button>

        <section className="step">
          <div className="step-head"><span className="step-num">1</span><h2>{ui(lang, 's1')}</h2></div>
          <p className="hint">{ui(lang, 's1h')}</p>
          <div className="games">
            {GAMES.map((g) => (
              <button key={g.id} className="game" aria-pressed={config.game === g.id} onClick={() => update({ game: g.id })}>
                <b>{g.name}</b>
                <span>{g.tagline[lang]}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="step">
          <div className="step-head"><span className="step-num">2</span><h2>{ui(lang, 's2')}</h2></div>
          <div className="templates" role="group" aria-label={ui(lang, 'templates')}>
            <span className="hint">{ui(lang, 'templates')}</span>
            {TEMPLATES.map((tpl) => {
              const features = normalizeFeatures(tpl.features);
              const active = features.length === config.features.length && features.every((f) => config.features.includes(f));
              return (
                <button
                  key={tpl.id}
                  className="chip"
                  aria-pressed={active}
                  title={tpl.description[lang]}
                  onClick={() => update({ features })}
                >
                  {tpl.name[lang]}
                </button>
              );
            })}
          </div>
          <p className="hint">{ui(lang, 's2h')}</p>
          <div className="feats">
            {FEATURES.map((f) => {
              const on = config.features.includes(f.id);
              const disabled = !!f.locked || !f.available;
              const tag = !f.available ? 'soon' : f.tier;
              return (
                <button key={f.id} className="feat" aria-pressed={on} disabled={disabled} onClick={() => toggle(f.id)}>
                  <span className="box" aria-hidden>{on ? '✓' : ''}</span>
                  <span className="feat-top">
                    <b>{f.name[lang]}</b>
                    <span className={`tag ${tag}`}>{ui(lang, tag)}</span>
                  </span>
                  <span className="desc">{f.description[lang]}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="step">
          <div className="step-head"><span className="step-num">3</span><h2>{ui(lang, 'sCustom')}</h2></div>
          <p className="hint">{ui(lang, 'sCustomHint')}</p>
          <Customize config={config} lang={lang} update={update} />
        </section>

        <section className="step">
          <div className="step-head"><span className="step-num">4</span><h2>{ui(lang, 's3')}</h2></div>
          <p className="hint">{ui(lang, 's3h')}</p>
          <textarea
            id="rules"
            rows={5}
            maxLength={1500}
            value={config.rules}
            onChange={(e) => update({ rules: e.target.value })}
          />
          <label className="inline" htmlFor="bot-lang">
            {ui(lang, 'botLang')}
            <select id="bot-lang" value={config.lang} onChange={(e) => update({ lang: e.target.value as Lang })}>
              <option value="th">ไทย</option>
              <option value="en">English</option>
            </select>
          </label>
        </section>

        <section className="step">
          <div className="step-head"><span className="step-num">5</span><h2>{ui(lang, 's4')}</h2></div>

          <div className="actions">
            <button className="btn" onClick={save} disabled={saving || (!dirty && detail.configured)}>
              {ui(lang, detail.botInstalled ? 'saveApply' : 'save')}
            </button>
            {!detail.botInstalled && (
              <a
                className={`btn ghost ${!detail.configured || dirty ? 'disabled' : ''}`}
                href={detail.inviteUrl}
                target="_blank"
                rel="noreferrer"
                aria-disabled={!detail.configured || dirty}
                onClick={(e) => {
                  if (!detail.configured || dirty) e.preventDefault();
                  else setWaitingForBot(true);
                }}
              >
                {ui(lang, 'addBot')}
              </a>
            )}
            {detail.botInstalled && (status === 'done' || status === 'error') && (
              <button
                className="btn ghost"
                onClick={() => api.resync(guildId).then(load).catch((e: Error) => setMessage({ kind: 'error', text: e.message }))}
              >
                {ui(lang, 'resync')}
              </button>
            )}
          </div>
          {!detail.botInstalled && <p className="hint">{ui(lang, 'addBotHint')}</p>}

          <div className={`status ${status}`} role="status">
            <span className="dot" />
            <span>{ui(lang, `status_${status}` as UiKey)}</span>
          </div>
          {status === 'error' && detail.provisionError && <p className="error">{detail.provisionError}</p>}
          {message && <p className={message.kind === 'error' ? 'error' : 'ok'}>{message.text}</p>}
        </section>
      </main>

      <aside className="preview" aria-label={ui(lang, 'preview')}>
        <div className="pv-head">
          <b>{detail.name}</b>
          <span>{ui(lang, 'preview')}</span>
        </div>
        <div className="pv-body">
          {channelsByCat.map((c) => (
            <div className="cat" key={c.key}>
              <h4>{c.name}</h4>
              {c.channels.map((ch) => {
                const label = ACCESS_LABEL[ch.access];
                return (
                  <div className="ch" key={ch.key}>
                    <i>{ch.type === 'voice' ? '🔊' : '#'}</i>
                    <span>{ch.name}</span>
                    {label && <em>{ui(lang, label)}</em>}
                    {!label && ch.readonly && <em>{ui(lang, 'readonly')}</em>}
                  </div>
                );
              })}
            </div>
          ))}
          {(['rank', 'class', 'ping'] as const).map((kind) => {
            const list = plan.roles.filter((r) => r.kind === kind);
            if (!list.length) return null;
            return (
              <div className="cat" key={kind}>
                <h4>{ui(lang, kind === 'rank' ? 'roles' : kind === 'class' ? 'classesTitle' : 'pingRolesShort')}</h4>
                <div className="roles">
                  {list.map((r) => (
                    <span className="role" key={r.key} style={{ '--c': hex(r.color) } as CSSProperties}>{r.name}</span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <div className="pv-foot">
          {plan.channels.length} {ui(lang, 'channels')} · {plan.roles.length} {ui(lang, 'rolesCount')}
        </div>
      </aside>
    </div>
  );
}
