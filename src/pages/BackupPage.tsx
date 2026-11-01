// 画面8: バックアップ・復元

import { useEffect, useRef, useState } from 'react';
import { useAppData } from '../AppData';
import { ConfirmDialog } from '../components/Dialog';
import { FileIcon, SaveIcon, UploadIcon } from '../components/Icons';
import { PageHeader } from '../components/Layout';
import { BackupValidationError, parseBackup, type BackupData, type ImportMode } from '../storage/backup';
import { repository } from '../storage/repository';

const pad = (n: number) => String(n).padStart(2, '0');

function backupFileName() {
  const d = new Date();
  return `bjj-backup-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.json`;
}

/** 読み込むファイルの上限(誤って巨大なファイルを選んだときの保護) */
const MAX_FILE_SIZE = 20 * 1024 * 1024;

export function BackupPage({ restore }: { restore: boolean }) {
  const { videos, practiceNotes, events, strengthRecords, reload, showToast } = useAppData();
  const restoreRef = useRef<HTMLHeadingElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const [fileName, setFileName] = useState<string | null>(null);
  const [parsed, setParsed] = useState<BackupData | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [mode, setMode] = useState<ImportMode>('replace');
  const [confirming, setConfirming] = useState(false);
  const [importing, setImporting] = useState(false);
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  // 設定画面の「復元」から来たときは復元欄までスクロールします
  useEffect(() => {
    if (restore) restoreRef.current?.scrollIntoView({ block: 'start' });
  }, [restore]);

  const exportJson = async () => {
    setExporting(true);
    setExportError(null);
    try {
      const data = await repository.exportAll();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = backupFileName();
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      showToast(
        `バックアップを作成しました(動画${data.videos.length}件・練習ノート${data.practiceNotes.length}件・予定${data.events.length}件・筋トレ実績${data.strengthRecords.length}件)`,
      );
    } catch (e) {
      setExportError(`バックアップの作成に失敗しました。${e instanceof Error ? e.message : ''}`);
    } finally {
      setExporting(false);
    }
  };

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // 同じファイルをもう一度選べるようにします
    setParsed(null);
    setFileError(null);
    setResultMessage(null);
    if (!file) return;
    setFileName(file.name);
    if (!/\.json$/i.test(file.name)) {
      setFileError('拡張子が .json のファイルを選択してください。');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setFileError('ファイルが大きすぎます(20MBまで)。');
      return;
    }
    try {
      setParsed(parseBackup(await file.text()));
    } catch (err) {
      setFileError(
        err instanceof BackupValidationError ? err.message : 'ファイルを読み込めませんでした。',
      );
    }
  };

  const runImport = async () => {
    if (!parsed) return;
    setImporting(true);
    try {
      const r = await repository.importBackup(parsed, mode);
      await reload();
      setResultMessage(
        mode === 'replace'
          ? `復元が完了しました。動画${r.addedVideos}件・練習ノート${r.addedNotes}件・予定${r.addedEvents}件・筋トレのデータ${r.addedStrength}件を読み込みました。`
          : `追加が完了しました。動画${r.addedVideos}件を追加${
              r.skippedVideos ? `、登録済みの${r.skippedVideos}件はスキップ` : ''
            }${r.addedCategories ? `、分類・種目を${r.addedCategories}件追加` : ''}、練習ノート${r.addedNotes}件を追加${
              r.skippedNotes ? `、登録済みの${r.skippedNotes}件はスキップ` : ''
            }、予定${r.addedEvents}件を追加${r.skippedEvents ? `、登録済みの${r.skippedEvents}件はスキップ` : ''}、筋トレのデータ${
              r.addedStrength
            }件を追加${r.skippedStrength ? `、登録済みの${r.skippedStrength}件はスキップ` : ''}しました。`,
      );
      setParsed(null);
      setFileName(null);
    } catch (e) {
      // 書き込みは1つのトランザクションで行っているため、失敗時は既存データがそのまま残ります
      setFileError(`復元に失敗しました。既存のデータは変更されていません。${e instanceof Error ? e.message : ''}`);
    } finally {
      setImporting(false);
      setConfirming(false);
    }
  };

  return (
    <div className="page">
      <PageHeader title="データのバックアップ" backTo="/settings" />

      <section className="card">
        <div className="card-head">
          <span className="setting-icon">
            <FileIcon />
          </span>
          <div>
            <h3 className="card-title">JSONファイルに書き出す</h3>
            <p className="card-desc">
              動画・分類・練習ノート・カレンダー予定・筋トレ(種目・動画・予定・実績)をJSON形式で保存できます。(現在の動画:
              {videos.length}件・練習ノート:{practiceNotes.length}件・予定:{events.length}件・筋トレ実績:
              {strengthRecords.length}件)
            </p>
          </div>
        </div>
        <button type="button" className="btn btn-primary btn-block" onClick={exportJson} disabled={exporting}>
          <SaveIcon size={18} /> {exporting ? '作成中…' : 'バックアップを作成'}
        </button>
        {exportError && <p className="field-error">{exportError}</p>}
      </section>

      <h2 className="section-title" ref={restoreRef}>
        データの復元
      </h2>
      <section className="card">
        <div className="card-head">
          <span className="setting-icon">
            <UploadIcon />
          </span>
          <div>
            <h3 className="card-title">JSONファイルを選択</h3>
            <p className="card-desc">対応ファイル:.json(このアプリで作成したバックアップ)</p>
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          className="visually-hidden"
          onChange={onFileChange}
          aria-label="復元するJSONファイル"
        />
        <button type="button" className="btn btn-secondary btn-block" onClick={() => fileInputRef.current?.click()}>
          ファイルを選択
        </button>
        {fileName && <p className="file-name">選択中:{fileName}</p>}
        {fileError && <p className="banner banner-error">{fileError}</p>}
        {parsed && (
          <p className="banner banner-info">
            読み込み可能です:動画{parsed.videos.length}件 / ポジション{parsed.positions.length}件 / 技の種類
            {parsed.techniqueTypes.length}件 / 練習ノート{parsed.practiceNotes.length}件 / 予定{parsed.events.length}件 / 筋トレ実績{parsed.strengthRecords.length}件
          </p>
        )}
      </section>

      <p className="field-label">復元方法を選択</p>
      <div className="radio-group">
        <label className="radio">
          <input type="radio" name="import-mode" checked={mode === 'replace'} onChange={() => setMode('replace')} />
          既存データを置き換える
        </label>
        <label className="radio">
          <input type="radio" name="import-mode" checked={mode === 'merge'} onChange={() => setMode('merge')} />
          既存データに追加する
        </label>
      </div>
      <p className="hint">
        {mode === 'replace'
          ? '今あるデータをすべて削除し、ファイルの内容に入れ替えます。'
          : '今あるデータを残したまま、ファイル内の動画・練習ノート・予定を追加します。同じもの(同じID)はスキップします。'}
      </p>

      <button
        type="button"
        className="btn btn-primary btn-block"
        disabled={!parsed || importing}
        onClick={() => setConfirming(true)}
      >
        {importing ? '復元中…' : '復元を開始'}
      </button>
      {resultMessage && <p className="banner banner-success">{resultMessage}</p>}

      {confirming && parsed && (
        <ConfirmDialog
          title={mode === 'replace' ? 'データを置き換えますか?' : 'データを追加しますか?'}
          message={
            mode === 'replace'
              ? `現在の動画${videos.length}件・練習ノート${practiceNotes.length}件・予定${events.length}件・筋トレ実績${strengthRecords.length}件と分類・種目はすべて削除され、ファイルの内容(動画${parsed.videos.length}件・練習ノート${parsed.practiceNotes.length}件・予定${parsed.events.length}件・筋トレ実績${parsed.strengthRecords.length}件)に置き換わります。この操作は取り消せません。`
              : `ファイル内の動画${parsed.videos.length}件・練習ノート${parsed.practiceNotes.length}件・予定${parsed.events.length}件・筋トレ実績${parsed.strengthRecords.length}件を現在のデータに追加します。`
          }
          confirmLabel={mode === 'replace' ? '置き換える' : '追加する'}
          danger={mode === 'replace'}
          busy={importing}
          onCancel={() => setConfirming(false)}
          onConfirm={runImport}
        />
      )}
    </div>
  );
}
