import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Film, Loader2, Play, Plus, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { resolveStorageUrl } from '@/lib/signedStorageUrl';
import { recentMoviesForUser } from '@/lib/recentMovies';

export interface SavedMovieClip { title: string; url: string; duration: number }

export default function RecentlyCreatedMovies({ onAdd }: { onAdd?: (clip: SavedMovieClip) => void }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<{ id: string; title: string } | null>(null);
  const [duration, setDuration] = useState(10);
  const [playbackError, setPlaybackError] = useState('');
  const queryKey = ['recent-movies', user?.id];
  const movies = useQuery({
    queryKey,
    enabled: !!user,
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase.from('user_media')
        .select('id,user_id,media_type,title,created_at').eq('user_id', user.id)
        .eq('media_type', 'video').order('created_at', { ascending: false }).limit(48);
      if (error) throw error;
      return recentMoviesForUser(data || [], user.id);
    },
  });
  useEffect(() => {
    const refresh = () => { void queryClient.invalidateQueries({ queryKey: ['recent-movies'] }); };
    window.addEventListener('library:updated', refresh);
    return () => window.removeEventListener('library:updated', refresh);
  }, [queryClient]);
  useEffect(() => { setSelected(null); setPlaybackError(''); }, [user?.id]);
  const clip = useQuery({
    queryKey: ['recent-movie-playback', user?.id, selected?.id],
    enabled: !!user && !!selected,
    queryFn: async () => {
      if (!user || !selected) return '';
      const { data, error } = await supabase.from('user_media').select('url')
        .eq('id', selected.id).eq('user_id', user.id).eq('media_type', 'video').single();
      if (error) throw error;
      const url = await resolveStorageUrl(data.url);
      if (!url) throw new Error('This movie has no saved video.');
      return url;
    },
    staleTime: 0,
  });

  return <section className="space-y-4" aria-label="Recently created movies">
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-lg font-semibold text-foreground flex items-center gap-2"><Film className="h-5 w-5 text-primary" /> Recently created</h2>
      <Button size="icon" variant="outline" aria-label="Refresh recent movies" onClick={() => void movies.refetch()}><RefreshCw className="h-4 w-4" /></Button>
    </div>
    {movies.isLoading && <p className="text-muted-foreground flex gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading movies…</p>}
    {movies.isError && <p role="alert" className="text-destructive">Could not load your movies. Try refreshing.</p>}
    {movies.data?.length === 0 && <p className="text-muted-foreground">No movies saved yet.</p>}
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {movies.data?.map(movie => <div key={movie.id} className="border border-border rounded-md p-3 bg-card flex items-start gap-3">
        <Film className="h-8 w-8 shrink-0 text-primary mt-1" />
        <div className="min-w-0 flex-1"><h3 className="font-medium break-words">{movie.title}</h3><p className="text-xs text-muted-foreground mt-1">{new Date(movie.created_at).toLocaleDateString()}</p></div>
        <Button size="icon" variant="outline" aria-label={`Play ${movie.title}`} onClick={() => { setSelected(movie); setPlaybackError(''); }}><Play className="h-4 w-4" /></Button>
      </div>)}
    </div>
    {selected && <div className="space-y-3 border-t border-border pt-4">
      <h3 className="font-semibold break-words">{selected.title}</h3>
      {clip.isFetching && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
      {clip.isError && <p role="alert" className="text-destructive">Could not open this saved movie. Try again.</p>}
      {clip.data && !clip.isFetching && <video key={clip.data} src={clip.data} controls playsInline preload="metadata" aria-label={selected.title} className="w-full aspect-video rounded-md bg-muted" onLoadedMetadata={event => { const seconds = event.currentTarget.duration; if (Number.isFinite(seconds) && seconds > 0) setDuration(seconds); }} onError={() => setPlaybackError('Your browser could not play this video. You can download the original.')} />}
      {playbackError && <p role="alert" className="text-destructive">{playbackError}</p>}
      <div className="flex flex-wrap gap-2">
        {clip.data && <Button variant="outline" asChild><a href={clip.data} download target="_blank" rel="noreferrer">Download movie</a></Button>}
        {clip.data && onAdd && <Button onClick={() => onAdd({ title: selected.title, url: clip.data || '', duration })}><Plus className="h-4 w-4 mr-2" /> Add to timeline</Button>}
      </div>
    </div>}
  </section>;
}