import { useEffect, useRef, useState } from 'react';
import { reimaginedClient as client } from './client';
import { freshWorkspace, workspaceSchema, type Workspace } from './model';

export function useWorkspace(userId: string | null) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const version = useRef(0);
  const busy = useRef(false);
  useEffect(() => {
    let active = true;
    setWorkspace(null);
    setError('');
    if (!userId) return;
    void (async () => {
      const result = await client.from('reimagined_workspaces').select('data,version').eq('user_id', userId).maybeSingle();
      if (!active) return;
      if (result.error) { setError('Unable to load saved activity. Please try signing in again.'); return; }
      if (result.data) {
        const parsed = workspaceSchema.safeParse(result.data.data);
        if (!parsed.success) { setError('Saved workspace could not be read. Your data has not been replaced.'); return; }
        version.current = result.data.version;
        setWorkspace(parsed.data);
      } else {
        const data = freshWorkspace();
        const insert = await client.from('reimagined_workspaces').insert({ user_id: userId, data });
        if (!active) return;
        if (insert.error) { setError('Unable to initialise the IT workspace. Please sign in again.'); return; }
        version.current = 0;
        setWorkspace(data);
      }
    })();
    return () => { active = false; };
  }, [userId]);
  async function save(next: Workspace) {
    if (!userId || busy.current) return false;
    busy.current = true; setSaving(true); setError('');
    try {
      const result = await client.from('reimagined_workspaces').update({ data: next, version: version.current + 1, updated_at: new Date().toISOString() }).eq('user_id', userId).eq('version', version.current).select('version').maybeSingle();
      if (result.error) { setError('Changes were not saved. Please retry.'); return false; }
      if (!result.data) {
        setError('Another IT visitor changed the shared workspace. Reload before saving; your changes were not applied.');
        return false;
      }
      version.current = result.data.version; setWorkspace(next); return true;
    } finally { busy.current = false; setSaving(false); }
  }
  return { workspace, save, saving, error };
}