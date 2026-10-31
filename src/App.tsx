// 画面の切り替え。URLの「#/...」に応じて表示する画面を選びます。

import { useAppData } from './AppData';
import { BackupPage } from './pages/BackupPage';
import { CategoryManagePage } from './pages/CategoryManagePage';
import { DetailPage } from './pages/DetailPage';
import { ListPage } from './pages/ListPage';
import { SettingsPage } from './pages/SettingsPage';
import { TagManagePage } from './pages/TagManagePage';
import { VideoFormPage } from './pages/VideoFormPage';
import { useRoute } from './router';

export function App() {
  const route = useRoute();
  const { toast } = useAppData();

  let page;
  switch (route.name) {
    case 'new':
      page = <VideoFormPage key="new" />;
      break;
    case 'edit':
      page = <VideoFormPage key={`edit-${route.id}`} videoId={route.id} />;
      break;
    case 'detail':
      page = <DetailPage videoId={route.id} />;
      break;
    case 'settings':
      page = <SettingsPage />;
      break;
    case 'categories':
      page = <CategoryManagePage key={route.kind} kind={route.kind} />;
      break;
    case 'tags':
      page = <TagManagePage />;
      break;
    case 'backup':
      page = <BackupPage restore={route.restore} />;
      break;
    default:
      page = <ListPage />;
  }

  return (
    <>
      {page}
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </>
  );
}
