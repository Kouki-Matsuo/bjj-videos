// タグ入力欄。自由入力で追加でき、既存のタグは候補からタップで再利用できます。

import { useState } from 'react';
import { CloseIcon, PlusIcon } from './Icons';

interface Props {
  value: string[];
  onChange: (tags: string[]) => void;
  suggestions: string[];
}

/** 先頭の#や前後の空白を取り除きます */
const cleanTag = (s: string) => s.trim().replace(/^#+/, '').trim();

export function TagInput({ value, onChange, suggestions }: Props) {
  const [text, setText] = useState('');

  const add = (raw: string) => {
    // 「、」「,」やスペースで区切って一度に複数入力することもできます
    const tags = raw.split(/[,、\s]+/).map(cleanTag).filter(Boolean);
    const next = [...value];
    tags.forEach((t) => !next.includes(t) && next.push(t.slice(0, 30)));
    onChange(next);
    setText('');
  };

  const query = cleanTag(text).toLowerCase();
  const candidates = suggestions
    .filter((t) => !value.includes(t) && (!query || t.toLowerCase().includes(query)))
    .slice(0, 12);

  return (
    <div>
      <div className="tag-input-row">
        <input
          id="video-tags"
          className="input"
          placeholder="タグを入力して追加"
          value={text}
          enterKeyHint="done"
          autoCapitalize="off"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            // 日本語変換の確定中のEnterでは追加しないようにします
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
              e.preventDefault();
              if (cleanTag(text)) add(text);
            }
          }}
        />
        <button
          type="button"
          className="icon-btn add-tag-btn"
          aria-label="タグを追加"
          disabled={!cleanTag(text)}
          onClick={() => add(text)}
        >
          <PlusIcon size={20} />
        </button>
      </div>

      {value.length > 0 && (
        <div className="chip-row chip-row-lg">
          {value.map((t) => (
            <button
              key={t}
              type="button"
              className="chip chip-tag chip-removable"
              aria-label={`タグ「${t}」を削除`}
              onClick={() => onChange(value.filter((x) => x !== t))}
            >
              #{t} <CloseIcon size={12} />
            </button>
          ))}
        </div>
      )}

      {candidates.length > 0 && (
        <>
          <p className="hint">{query ? '候補(タップで追加)' : '登録済みのタグ(タップで追加)'}</p>
          <div className="chip-row chip-row-lg">
            {candidates.map((t) => (
              <button key={t} type="button" className="chip chip-suggest" onClick={() => add(t)}>
                ＋ #{t}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
