import { describe, expect, it } from 'vitest';
import { recentMoviesForUser } from './recentMovies';

describe('Recently created movies', () => {
  it('shows only the current account videos, newest first', () => {
    const rows = [
      { id: 'older', user_id: 'owner', media_type: 'video', title: 'Older movie', created_at: '2026-10-25T00:00:00Z' },
      { id: 'foreign', user_id: 'other', media_type: 'video', title: 'Private movie', created_at: '2026-10-27T00:00:00Z' },
      { id: 'photo', user_id: 'owner', media_type: 'image', title: 'Photo', created_at: '2026-10-27T00:00:00Z' },
      { id: 'uap', user_id: 'owner', media_type: 'video', title: 'UAP landing', created_at: '2026-10-26T00:00:00Z' },
    ];
    expect(recentMoviesForUser(rows, 'owner').map(row => row.id)).toEqual(['uap', 'older']);
    expect(recentMoviesForUser(rows, 'signed-out')).toEqual([]);
  });
});