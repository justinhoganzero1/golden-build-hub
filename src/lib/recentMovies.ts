export interface RecentMovie {
  id: string;
  user_id: string;
  media_type: string;
  title: string;
  created_at: string;
}

export function recentMoviesForUser(items: RecentMovie[], userId: string): RecentMovie[] {
  return items.filter(item => item.user_id === userId && item.media_type === 'video')
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
}