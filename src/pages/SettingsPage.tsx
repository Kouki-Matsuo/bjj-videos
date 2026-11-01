// 画面4: 設定

import { useState, type ReactNode } from 'react';
import { useAppData } from '../AppData';
import { Dialog } from '../components/Dialog';
import { ChevronRightIcon, DownloadIcon, ShieldIcon, TagIcon, TypeIcon, UploadIcon } from '../components/Icons';
import { BottomNav, PageHeader } from '../components/Layout';
import { navigate } from '../router';

const APP_VERSION = '1.2.0';

function SettingRow({ icon, title, sub, onClick }: { icon?: ReactNode; title: string; sub?: string; onClick: () => void }) {
  return (
    <button type="button" className="setting-row" onClick={onClick}>
      {icon && <span className="setting-icon">{icon}</span>}
      <span className="setting-text">
        <span className="setting-title">{title}</span>
        {sub && <span className="setting-sub">{sub}</span>}
      </span>
      <ChevronRightIcon size={18} className="setting-chevron" />
    </button>
  );
}

export function SettingsPage() {
  const { positions, techniqueTypes, allTags } = useAppData();
  const [aboutOpen, setAboutOpen] = useState(false);

  return (
    <div className="page has-nav">
      <PageHeader title="設定" />

      <h2 className="section-title">分類の管理</h2>
      <div className="group">
        <SettingRow
          icon={<ShieldIcon />}
          title="ポジション"
          sub={`${positions.length}種類(編集・追加・削除)`}
          onClick={() => navigate('/settings/positions')}
        />
        <SettingRow
          icon={<TypeIcon />}
          title="技の種類"
          sub={`${techniqueTypes.length}種類(編集・追加・削除)`}
          onClick={() => navigate('/settings/techniqueTypes')}
        />
        <SettingRow
          icon={<TagIcon />}
          title="タグ"
          sub={`${allTags.length}件(名称変更・削除)`}
          onClick={() => navigate('/settings/tags')}
        />
      </div>

      <h2 className="section-title">データ管理</h2>
      <div className="group">
        <SettingRow
          icon={<DownloadIcon />}
          title="バックアップ"
          sub="JSONで書き出し"
          onClick={() => navigate('/settings/backup')}
        />
        <SettingRow
          icon={<UploadIcon />}
          title="復元"
          sub="JSONから読み込み"
          onClick={() => navigate('/settings/restore')}
        />
      </div>

      <h2 className="section-title">アプリ情報</h2>
      <div className="group">
        <div className="setting-row static">
          <span className="setting-text">
            <span className="setting-title">バージョン</span>
          </span>
          <span className="muted">{APP_VERSION}</span>
        </div>
        <SettingRow title="このアプリについて" onClick={() => setAboutOpen(true)} />
      </div>

      <BottomNav active="settings" />

      {aboutOpen && (
        <Dialog
          title="このアプリについて"
          onClose={() => setAboutOpen(false)}
          actions={
            <button type="button" className="btn btn-primary" onClick={() => setAboutOpen(false)}>
              閉じる
            </button>
          }
        >
          <p>Instagram・YouTubeで見つけた柔術の技術動画を、技名・ポジション・タグで整理するためのアプリです。</p>
          <p>
            動画そのものは保存せず、URLと管理情報だけをこの端末のブラウザ内に保存します。ブラウザのデータを消去するとデータも消えるため、定期的にバックアップを作成してください。
          </p>
        </Dialog>
      )}
    </div>
  );
}
