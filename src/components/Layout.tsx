// 画面の見出し・下部ナビゲーション・スイッチなど、各画面で共通の部品です。

import type { ReactNode } from 'react';
import { goBack, navigate } from '../router';
import { ChevronLeftIcon, GearIcon, HomeIcon, NoteIcon, PlusCircleIcon } from './Icons';

interface HeaderProps {
  title: string;
  /** 指定すると左に「戻る」ボタンを出します。値は履歴がないときの移動先 */
  backTo?: string;
  onBack?: () => void;
  right?: ReactNode;
}

export function PageHeader({ title, backTo, onBack, right }: HeaderProps) {
  const hasBack = backTo !== undefined || onBack !== undefined;
  return (
    <header className={`page-header ${hasBack ? 'with-back' : ''}`}>
      {hasBack && (
        <button
          type="button"
          className="icon-btn back-btn"
          aria-label="戻る"
          onClick={() => (onBack ? onBack() : goBack(backTo ?? '/'))}
        >
          <ChevronLeftIcon size={24} />
        </button>
      )}
      <h1>{title}</h1>
      {right && <div className="page-header-right">{right}</div>}
    </header>
  );
}

type Tab = 'list' | 'new' | 'notes' | 'settings';

export function BottomNav({ active }: { active: Tab }) {
  const items: { tab: Tab; label: string; path: string; icon: ReactNode }[] = [
    { tab: 'list', label: '一覧', path: '/', icon: <HomeIcon size={22} filled={active === 'list'} /> },
    { tab: 'new', label: '登録', path: '/new', icon: <PlusCircleIcon size={22} /> },
    { tab: 'notes', label: '練習ノート', path: '/notes', icon: <NoteIcon size={22} /> },
    { tab: 'settings', label: '設定', path: '/settings', icon: <GearIcon size={22} /> },
  ];
  return (
    <nav className="bottom-nav" aria-label="メインメニュー">
      {items.map((item) => (
        <button
          key={item.tab}
          type="button"
          className={`nav-item ${active === item.tab ? 'active' : ''}`}
          aria-current={active === item.tab ? 'page' : undefined}
          onClick={() => active !== item.tab && navigate(item.path, { replace: item.tab !== 'new' })}
        >
          {item.icon}
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}

interface SwitchProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}

/** iPhone風のON/OFFスイッチ */
export function Switch({ checked, onChange, label }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`switch ${checked ? 'on' : ''}`}
      onClick={() => onChange(!checked)}
    >
      <span className="switch-knob" />
    </button>
  );
}

/** ポジションなどを選ぶプルダウン */
export function Select({
  id,
  value,
  onChange,
  emptyLabel,
  options,
}: {
  id?: string;
  value: string | null;
  onChange: (v: string | null) => void;
  emptyLabel: string;
  options: { id: string; name: string }[];
}) {
  return (
    <div className="select-wrap">
      <select id={id} className="input select" value={value ?? ''} onChange={(e) => onChange(e.target.value || null)}>
        <option value="">{emptyLabel}</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </div>
  );
}
