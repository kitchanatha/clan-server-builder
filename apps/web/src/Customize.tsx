import { useState } from 'react';
import {
  DEFAULT_RANKS,
  NICKNAME_FORMATS,
  classList,
  fillTemplate,
  formatNickname,
  t,
  type GuildConfig,
  type Lang,
  type RoleKey,
} from '@csb/shared';
import { ui } from './i18n';

const RANK_KEYS: RoleKey[] = ['leader', 'officer', 'member', 'guest'];

/** One item per line; keeps the user's typing (blank lines) while editing. */
function ListField(props: {
  id: string;
  value: string[];
  placeholder: string;
  max: number;
  onChange: (items: string[]) => void;
}) {
  const [draft, setDraft] = useState(props.value.join('\n'));
  return (
    <textarea
      id={props.id}
      rows={Math.min(8, Math.max(3, props.value.length + 1))}
      value={draft}
      placeholder={props.placeholder}
      onChange={(e) => {
        setDraft(e.target.value);
        props.onChange(
          e.target.value
            .split('\n')
            .map((l) => l.trim().slice(0, 32))
            .filter(Boolean)
            .slice(0, props.max),
        );
      }}
    />
  );
}

export function Customize({
  config,
  lang,
  update,
}: {
  config: GuildConfig;
  lang: Lang;
  update: (patch: Partial<GuildConfig>) => void;
}) {
  const has = (f: string) => config.features.includes(f as GuildConfig['features'][number]);
  const member = config.member;
  const setMember = (patch: Partial<GuildConfig['member']>) => update({ member: { ...member, ...patch } });
  const preset = classList(config.game);
  const classes = classList(config.game, config.classes);
  const sampleClass = member.askClass ? classes[0] ?? '' : '';

  return (
    <div className="custom">
      <fieldset>
        <legend>{ui(lang, 'ranksTitle')}</legend>
        <p className="hint">{ui(lang, 'ranksHint')}</p>
        <div className="ranks">
          {RANK_KEYS.filter((k) => k !== 'guest' || has('welcome')).map((k) => (
            <label key={k} htmlFor={`rank-${k}`}>
              <span>{DEFAULT_RANKS[k]}</span>
              <input
                id={`rank-${k}`}
                maxLength={32}
                value={config.ranks[k]}
                onChange={(e) => update({ ranks: { ...config.ranks, [k]: e.target.value } })}
                onBlur={(e) => {
                  if (!e.target.value.trim()) update({ ranks: { ...config.ranks, [k]: DEFAULT_RANKS[k] } });
                }}
              />
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend>{ui(lang, 'classesTitle')}</legend>
        <p className="hint">{ui(lang, 'classesHint')}</p>
        <ListField
          id="classes"
          value={config.classes}
          placeholder={preset.join('\n')}
          max={25}
          onChange={(items) => update({ classes: items })}
        />
      </fieldset>

      {has('welcome') && (
        <fieldset>
          <legend>{ui(lang, 'registerTitle')}</legend>
          <label className="check" htmlFor="ask-class">
            <input id="ask-class" type="checkbox" checked={member.askClass} onChange={(e) => setMember({ askClass: e.target.checked })} />
            {ui(lang, 'askClass')}
          </label>
          <label className="inline" htmlFor="nick-format">
            {ui(lang, 'nickFormat')}
            <select id="nick-format" value={member.nicknameFormat} onChange={(e) => setMember({ nicknameFormat: e.target.value })}>
              {NICKNAME_FORMATS.map((f) => (
                <option key={f} value={f}>
                  {formatNickname(f, 'Boom', sampleClass || classes[0] || 'Class')}
                </option>
              ))}
            </select>
          </label>
          <p className="hint">
            {ui(lang, 'nickExample')} <code>{formatNickname(member.nicknameFormat, 'Boom', sampleClass)}</code>
          </p>
          <label htmlFor="welcome-msg" className="stack">
            {ui(lang, 'welcomeMsg')}
            <textarea
              id="welcome-msg"
              rows={2}
              maxLength={500}
              value={member.welcomeMessage}
              placeholder={t(config.lang, 'joinGreeting')}
              onChange={(e) => setMember({ welcomeMessage: e.target.value })}
            />
          </label>
          <p className="hint">
            {ui(lang, 'placeholders')} <code>{'{user} {name} {guild} {count} {welcome}'}</code>
          </p>
        </fieldset>
      )}

      {has('goodbye') && (
        <fieldset>
          <legend>{ui(lang, 'goodbyeTitle')}</legend>
          <label htmlFor="goodbye-msg" className="stack">
            {ui(lang, 'goodbyeMsg')}
            <textarea
              id="goodbye-msg"
              rows={2}
              maxLength={500}
              value={member.goodbyeMessage}
              placeholder={t(config.lang, 'goodbyeDefault')}
              onChange={(e) => setMember({ goodbyeMessage: e.target.value })}
            />
          </label>
          <p className="hint">
            {ui(lang, 'example')}{' '}
            {fillTemplate(member.goodbyeMessage.trim() || t(config.lang, 'goodbyeDefault'), {
              user: 'Boom',
              name: 'Boom',
              guild: 'Night Owls',
              count: 128,
            }).replace(/\*\*/g, '')}
          </p>
        </fieldset>
      )}

      {(has('welcome') || has('roles')) && (
        <fieldset>
          <legend>{ui(lang, 'rolesTitle')}</legend>
          <label className="check" htmlFor="class-roles">
            <input id="class-roles" type="checkbox" checked={member.classRoles} onChange={(e) => setMember({ classRoles: e.target.checked })} />
            {ui(lang, 'classRoles')}
          </label>
          {has('roles') && (
            <label htmlFor="ping-roles" className="stack">
              {ui(lang, 'pingRoles')}
              <ListField
                id="ping-roles"
                value={member.pingRoles}
                placeholder={'Raid Alerts\nGuild War\nEvents'}
                max={10}
                onChange={(items) => setMember({ pingRoles: items })}
              />
            </label>
          )}
        </fieldset>
      )}
    </div>
  );
}
