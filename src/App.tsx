// 画面の切り替え。URLの「#/...」に応じて表示する画面を選びます。

import { useAppData } from './AppData';
import { BackupPage } from './pages/BackupPage';
import { CalendarPage } from './pages/CalendarPage';
import { CategoryManagePage } from './pages/CategoryManagePage';
import { DetailPage } from './pages/DetailPage';
import { EventFormPage } from './pages/EventFormPage';
import { ListPage } from './pages/ListPage';
import { PracticeListPage } from './pages/PracticeListPage';
import { PracticeNoteDetailPage } from './pages/PracticeNoteDetailPage';
import { PracticeNoteFormPage } from './pages/PracticeNoteFormPage';
import { SettingsPage } from './pages/SettingsPage';
import { ExerciseFormPage } from './pages/strength/ExerciseFormPage';
import { PlanDetailPage, PlanFormPage } from './pages/strength/PlanPages';
import { RecordDetailPage, RecordFormPage } from './pages/strength/RecordPages';
import { StrengthPage } from './pages/strength/StrengthPage';
import { StrengthVideoDetailPage, StrengthVideoFormPage } from './pages/strength/StrengthVideoPages';
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
    case 'notes':
      page = <PracticeListPage />;
      break;
    case 'noteNew':
      page = (
        <PracticeNoteFormPage
          key={`note-new-${route.videoId ?? ''}-${route.date ?? ''}`}
          initialVideoId={route.videoId}
          initialDate={route.date}
        />
      );
      break;
    case 'noteDetail':
      page = <PracticeNoteDetailPage noteId={route.id} />;
      break;
    case 'noteEdit':
      page = <PracticeNoteFormPage key={`note-edit-${route.id}`} noteId={route.id} />;
      break;
    case 'calendar':
      page = <CalendarPage date={route.date} />;
      break;
    case 'eventNew':
      page = <EventFormPage key={`event-new-${route.date ?? ''}`} initialDate={route.date} />;
      break;
    case 'eventEdit':
      page = <EventFormPage key={`event-edit-${route.id}`} eventId={route.id} />;
      break;
    case 'strength':
      page = <StrengthPage tab={route.tab} exerciseId={route.exerciseId} />;
      break;
    case 'exerciseForm':
      page = <ExerciseFormPage key={`exercise-${route.id ?? 'new'}`} exerciseId={route.id} />;
      break;
    case 'sVideoForm':
      page = (
        <StrengthVideoFormPage
          key={`svideo-${route.id ?? 'new'}`}
          videoId={route.id}
          initialExerciseId={route.exerciseId}
        />
      );
      break;
    case 'sVideoDetail':
      page = <StrengthVideoDetailPage videoId={route.id} />;
      break;
    case 'planForm':
      page = <PlanFormPage key={`plan-${route.id ?? `new-${route.date}`}`} planId={route.id} initialDate={route.date} />;
      break;
    case 'planDetail':
      page = <PlanDetailPage planId={route.id} />;
      break;
    case 'recordForm':
      page = (
        <RecordFormPage
          key={`record-${route.id ?? `new-${route.date}-${route.planId}`}`}
          recordId={route.id}
          initialDate={route.date}
          planId={route.planId}
        />
      );
      break;
    case 'recordDetail':
      page = <RecordDetailPage recordId={route.id} />;
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
