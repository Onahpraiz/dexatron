/* ============================================================
   Dexatron Content Store, Supabase edition
   Shared between index.html (public site) and admin.html.

   This replaces the earlier IndexedDB-based prototype. Content
   now lives in a real Supabase table and files go into real
   Supabase Storage, so uploads are visible to any visitor, on
   any device, anywhere, not just the browser they were uploaded
   from.

   Row Level Security policies (set up separately in Supabase)
   are what actually enforce that only a logged-in admin can
   write, while anyone can read published rows. This file just
   calls the Supabase client, it doesn't do any security checks
   itself, the database does that.
   ============================================================ */

const SUPABASE_URL = 'https://igevwgfmzuukddykduib.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlnZXZ3Z2ZtenV1a2RkeWtkdWliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk2MjA0NDcsImV4cCI6MjEwNTE5NjQ0N30.E9lM9yk-3vJT-0TjyYnRSxEvSFoxM2m4kDSuo0kpaHc';
const TABLE_NAME = 'dexatrondatabasetable';
const BUCKET_NAME = 'dexatronimageandvideouploads';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const DexatronStore = (() => {

  async function getAll() {
    const { data, error } = await supabaseClient
      .from(TABLE_NAME)
      .select('*')
      .order('date', { ascending: false });
    if (error) throw error;
    return data;
  }

  async function getPublished() {
    const { data, error } = await supabaseClient
      .from(TABLE_NAME)
      .select('*')
      .eq('published', true)
      .order('date', { ascending: false });
    if (error) throw error;
    return data;
  }

  async function uploadFile(file, folder) {
    const ext = (file.name && file.name.includes('.')) ? file.name.split('.').pop() : (file.type.split('/')[1] || 'bin');
    const path = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabaseClient.storage.from(BUCKET_NAME).upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    });
    if (error) throw error;
    const { data } = supabaseClient.storage.from(BUCKET_NAME).getPublicUrl(path);
    return data.publicUrl;
  }

  /* item: { title, description, category, date, featured, published,
             mediaFile (File), mediaType ('image'|'video'), thumbFile (Blob, optional) } */
  async function add(item) {
    const mediaUrl = await uploadFile(item.mediaFile, 'media');
    const thumbUrl = item.thumbFile ? await uploadFile(item.thumbFile, 'thumbs') : mediaUrl;

    const row = {
      title: item.title,
      description: item.description || '',
      category: item.category,
      date: item.date,
      media_url: mediaUrl,
      thumb_url: thumbUrl,
      media_type: item.mediaType,
      featured: !!item.featured,
      published: !!item.published,
    };
    const { data, error } = await supabaseClient.from(TABLE_NAME).insert(row).select().single();
    if (error) throw error;
    return data;
  }

  /* changes may include any of the meta fields, plus optionally
     mediaFile / mediaType / thumbFile if the file is being replaced */
  async function update(id, changes) {
    const row = {};
    if (changes.title !== undefined) row.title = changes.title;
    if (changes.description !== undefined) row.description = changes.description;
    if (changes.category !== undefined) row.category = changes.category;
    if (changes.date !== undefined) row.date = changes.date;
    if (changes.featured !== undefined) row.featured = !!changes.featured;
    if (changes.published !== undefined) row.published = !!changes.published;

    if (changes.mediaFile) {
      row.media_url = await uploadFile(changes.mediaFile, 'media');
      row.media_type = changes.mediaType;
      row.thumb_url = changes.thumbFile ? await uploadFile(changes.thumbFile, 'thumbs') : row.media_url;
    }

    const { data, error } = await supabaseClient.from(TABLE_NAME).update(row).eq('id', id).select().single();
    if (error) throw error;
    return data;
  }

  async function remove(id) {
    const { error } = await supabaseClient.from(TABLE_NAME).delete().eq('id', id);
    if (error) throw error;
  }

  /* Capture a still frame from a video File as a JPEG Blob, for use as a thumbnail. */
  function videoThumbnail(file) {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const video = document.createElement('video');
      video.src = url;
      video.muted = true;
      video.playsInline = true;
      video.addEventListener('loadeddata', () => {
        video.currentTime = Math.min(0.3, (video.duration || 1) / 4);
      });
      video.addEventListener('seeked', () => {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 360;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(blob => {
          URL.revokeObjectURL(url);
          resolve(blob);
        }, 'image/jpeg', 0.8);
      });
      video.addEventListener('error', () => { URL.revokeObjectURL(url); resolve(null); });
    });
  }

  return { getAll, getPublished, add, update, remove, videoThumbnail, client: supabaseClient };
})();
