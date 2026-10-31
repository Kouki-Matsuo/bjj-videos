// 確認ダイアログ・入力ダイアログ・下から出るシートの共通部品です。

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { CloseIcon } from './Icons';

/** 表示中は背面のページがスクロールしないようにします */
function useLockScroll() {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);
}

interface DialogProps {
  title: string;
  children?: ReactNode;
  onClose: () => void;
  actions: ReactNode;
}

export function Dialog({ title, children, onClose, actions }: DialogProps) {
  useLockScroll();
  return (
    <div className="overlay center" onClick={onClose}>
      <div className="dialog" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <h2 className="dialog-title">{title}</h2>
        {children && <div className="dialog-body">{children}</div>}
        <div className="dialog-actions">{actions}</div>
      </div>
    </div>
  );
}

interface ConfirmProps {
  title: string;
  message?: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ title, message, confirmLabel, danger, busy, onConfirm, onCancel }: ConfirmProps) {
  return (
    <Dialog
      title={title}
      onClose={onCancel}
      actions={
        <>
          <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={busy}>
            キャンセル
          </button>
          <button
            type="button"
            className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
            onClick={onConfirm}
            disabled={busy}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      {message}
    </Dialog>
  );
}

interface PromptProps {
  title: string;
  label: string;
  initialValue?: string;
  placeholder?: string;
  confirmLabel: string;
  /** 保存処理。エラーメッセージを返すとダイアログ内に表示し、閉じません */
  onSubmit: (value: string) => Promise<string | null>;
  onCancel: () => void;
}

export function PromptDialog({ title, label, initialValue = '', placeholder, confirmLabel, onSubmit, onCancel }: PromptProps) {
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = async () => {
    if (!value.trim()) {
      setError('名前を入力してください。');
      return;
    }
    setBusy(true);
    const err = await onSubmit(value.trim());
    setBusy(false);
    if (err) setError(err);
  };

  return (
    <Dialog
      title={title}
      onClose={onCancel}
      actions={
        <>
          <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={busy}>
            キャンセル
          </button>
          <button type="submit" form="prompt-form" className="btn btn-primary" disabled={busy}>
            {confirmLabel}
          </button>
        </>
      }
    >
      <form
        id="prompt-form"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <label className="field-label" htmlFor="prompt-input">
          {label}
        </label>
        <input
          ref={inputRef}
          id="prompt-input"
          className="input"
          value={value}
          placeholder={placeholder}
          maxLength={40}
          enterKeyHint="done"
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
        />
        {error && <p className="field-error">{error}</p>}
      </form>
    </Dialog>
  );
}

interface SheetProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

/** 画面下からせり上がるパネル(検索・絞り込みなどで使用) */
export function Sheet({ title, onClose, children, footer }: SheetProps) {
  useLockScroll();
  return (
    <div className="overlay bottom" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-header">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" aria-label="閉じる" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-footer">{footer}</div>}
      </div>
    </div>
  );
}
