// ===== WorkTunes Offline Player =====
const audio = document.getElementById('audio');
const content = document.getElementById('content');
const playlistList = document.getElementById('playlist-list');
const fileInput = document.getElementById('file-input');
const searchInput = document.getElementById('search-input');

// State
let playlists = [
  { id: 'opm', name: "Leigh's Playlist", tracks: [] },
  { id: 'my', name: 'My Playlist', tracks: [] }
];
let currentPlaylistId = 'opm';
let currentIndex = -1;
let isPlaying = false;
let isShuffle = false;
let repeatMode = 0; // 0 = off, 1 = all, 2 = one
let volume = 0.8;
let objectUrls = new Map(); // trackId -> objectURL

// Built-in local files that will auto-load if present in the same folder
const BUILTIN_TRACKS = [
  { file: 'music1.mp3', name: 'Music 1', artist: 'Local File' },
  { file: 'music2.mp3', name: 'Music 2', artist: 'Local File' },
  { file: 'music3.mp3', name: 'OPM 3', artist: 'Local File' },
  { file: 'music4.mp3', name: 'Music 4', artist: 'Local File' },
  { file: 'music5.mp3', name: 'Music 5', artist: 'Local File' }
];

// DOM refs
const playBtn = document.getElementById('play-btn');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const shuffleBtn = document.getElementById('shuffle-btn');
const repeatBtn = document.getElementById('repeat-btn');
const progressBar = document.getElementById('progress-bar');
const progressFill = document.getElementById('progress-fill');
const progressHandle = document.getElementById('progress-handle');
const currentTimeEl = document.getElementById('current-time');
const durationEl = document.getElementById('duration');
const volumeBar = document.getElementById('volume-bar');
const volumeFill = document.getElementById('volume-fill');
const muteBtn = document.getElementById('mute-btn');
const nowTitle = document.getElementById('now-title');
const nowArtist = document.getElementById('now-artist');
const nowCover = document.getElementById('now-cover');
const likeBtn = document.getElementById('like-btn');
const addFilesBtn = document.getElementById('add-files-btn');
const newPlaylistBtn = document.getElementById('new-playlist-btn');

// ===== Helpers =====
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function formatTime(sec) {
  if (!isFinite(sec) || isNaN(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function getCurrentPlaylist() {
  return playlists.find(p => p.id === currentPlaylistId) || playlists[0];
}

function getTracks() {
  return getCurrentPlaylist().tracks;
}

function getCurrentTrack() {
  const tracks = getTracks();
  return currentIndex >= 0 && currentIndex < tracks.length ? tracks[currentIndex] : null;
}

// ===== Rendering =====
function renderPlaylists() {
  playlistList.innerHTML = playlists.map(p => `
    <li class="playlist-item ${p.id === currentPlaylistId ? 'active' : ''}" data-id="${p.id}">
      ${p.name} <span style="opacity:0.5;font-size:0.8em">(${p.tracks.length})</span>
    </li>
  `).join('');
}

function renderContent(filter = '') {
  const pl = getCurrentPlaylist();
  let tracks = pl.tracks;
  if (filter) {
    const q = filter.toLowerCase();
    tracks = tracks.filter(t =>
      t.name.toLowerCase().includes(q) ||
      (t.artist && t.artist.toLowerCase().includes(q))
    );
  }

  if (tracks.length === 0) {
    content.innerHTML = `
      <div class="empty-state">
        <h2>${pl.name}</h2>
        <p>No songs yet. Click <strong>+ Add Songs</strong> or drag & drop MP3 / M4A files here.</p>
        <button class="btn-primary" id="empty-add-btn">+ Add Songs</button>
      </div>
    `;
    document.getElementById('empty-add-btn')?.addEventListener('click', () => fileInput.click());
    return;
  }

  const totalDuration = tracks.reduce((acc, t) => acc + (t.duration || 0), 0);

  content.innerHTML = `
    <div class="hero">
      <div class="hero-cover"><img src="logo.jpg" alt="Playlist Cover"></div>
      <div class="hero-info">
        <div style="font-size:0.75rem;font-weight:600;letter-spacing:0.08em;color:var(--text-sub);margin-bottom:6px">PLAYLIST</div>
        <h1>${pl.name}</h1>
        <div class="hero-meta">${tracks.length} songs • ${formatTime(totalDuration)}</div>
        <div class="hero-actions">
          <button class="play-large" id="hero-play">▶</button>
          <button class="btn-primary" id="hero-add">+ Add Songs</button>
        </div>
      </div>
    </div>

    <table class="track-table">
      <thead>
        <tr>
          <th class="track-num">#</th>
          <th>TITLE</th>
          <th>ARTIST</th>
          <th class="track-duration">⏱</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        ${tracks.map((t, i) => {
          const realIndex = pl.tracks.indexOf(t);
          const isCurrent = realIndex === currentIndex && currentPlaylistId === pl.id;
          return `
            <tr class="${isCurrent ? 'playing' : ''}" data-index="${realIndex}">
              <td class="track-num">${isCurrent && isPlaying ? '▶' : realIndex + 1}</td>
              <td>
                <div class="track-name">${escapeHtml(t.name)}</div>
              </td>
              <td class="track-artist">${escapeHtml(t.artist || 'Unknown Artist')}</td>
              <td class="track-duration">${formatTime(t.duration)}</td>
              <td class="track-actions">
                <button class="icon-btn remove-btn" data-index="${realIndex}" title="Remove">×</button>
              </td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;

  document.getElementById('hero-play')?.addEventListener('click', () => {
    if (currentIndex === -1 && tracks.length) playTrack(0);
    else togglePlay();
  });
  document.getElementById('hero-add')?.addEventListener('click', () => fileInput.click());

  content.querySelectorAll('tbody tr').forEach(row => {
    row.addEventListener('dblclick', () => {
      const idx = parseInt(row.dataset.index, 10);
      playTrack(idx);
    });
    row.addEventListener('click', (e) => {
      if (e.target.closest('.remove-btn')) return;
      const idx = parseInt(row.dataset.index, 10);
      if (idx === currentIndex) togglePlay();
      else playTrack(idx);
    });
  });

  content.querySelectorAll('.remove-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.index, 10);
      removeTrack(idx);
    });
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function updateNowPlaying() {
  const track = getCurrentTrack();
  if (!track) {
    nowTitle.textContent = 'No track selected';
    nowArtist.textContent = '—';
    nowCover.innerHTML = '<span class="cover-placeholder">♪</span>';
    return;
  }
  nowTitle.textContent = track.name;
  nowArtist.textContent = track.artist || 'Unknown Artist';
  nowCover.innerHTML = '<span class="cover-placeholder">♪</span>';
}

function updatePlayButton() {
  playBtn.textContent = isPlaying ? '⏸' : '▶';
}

// ===== Playback =====
function playTrack(index) {
  const tracks = getTracks();
  if (index < 0 || index >= tracks.length) return;

  currentIndex = index;
  const track = tracks[index];

  // Support both built-in files (src path) and user-added File objects
  if (track.isBuiltin && track.src) {
    audio.src = track.src;
  } else if (track.file) {
    if (!objectUrls.has(track.id)) {
      objectUrls.set(track.id, URL.createObjectURL(track.file));
    }
    audio.src = objectUrls.get(track.id);
  } else {
    console.error('Track has no playable source');
    return;
  }

  audio.load();
  audio.play().then(() => {
    isPlaying = true;
    updatePlayButton();
    updateNowPlaying();
    renderContent(searchInput.value);
  }).catch(err => {
    console.error('Play failed:', err);
    alert('Could not play this file. Make sure music1.mp3 / music2.mp3 are in the same folder, or add supported audio files (MP3, M4A, OGG, WAV).');
  });
}

function togglePlay() {
  if (currentIndex === -1) {
    const tracks = getTracks();
    if (tracks.length) playTrack(0);
    return;
  }
  if (isPlaying) {
    audio.pause();
    isPlaying = false;
  } else {
    audio.play().then(() => { isPlaying = true; }).catch(() => {});
  }
  updatePlayButton();
  renderContent(searchInput.value);
}

function playNext() {
  const tracks = getTracks();
  if (!tracks.length) return;

  if (repeatMode === 2) {
    playTrack(currentIndex);
    return;
  }

  let next;
  if (isShuffle) {
    if (tracks.length === 1) next = 0;
    else {
      do { next = Math.floor(Math.random() * tracks.length); }
      while (next === currentIndex);
    }
  } else {
    next = currentIndex + 1;
    if (next >= tracks.length) {
      if (repeatMode === 1) next = 0;
      else {
        isPlaying = false;
        updatePlayButton();
        return;
      }
    }
  }
  playTrack(next);
}

function playPrev() {
  if (audio.currentTime > 3) {
    audio.currentTime = 0;
    return;
  }
  const tracks = getTracks();
  if (!tracks.length) return;

  let prev = currentIndex - 1;
  if (prev < 0) prev = tracks.length - 1;
  playTrack(prev);
}

function removeTrack(index) {
  const pl = getCurrentPlaylist();
  const track = pl.tracks[index];
  if (!track) return;

  if (objectUrls.has(track.id)) {
    URL.revokeObjectURL(objectUrls.get(track.id));
    objectUrls.delete(track.id);
  }

  pl.tracks.splice(index, 1);

  if (currentIndex === index) {
    audio.pause();
    isPlaying = false;
    currentIndex = -1;
    audio.src = '';
    updatePlayButton();
    updateNowPlaying();
  } else if (currentIndex > index) {
    currentIndex--;
  }

  renderPlaylists();
  renderContent(searchInput.value);
  saveState();
}

// ===== File handling =====
function addFiles(files) {
  const pl = getCurrentPlaylist();
  const audioFiles = Array.from(files).filter(f => f.type.startsWith('audio/') || /\.(mp3|m4a|ogg|wav|flac|aac)$/i.test(f.name));

  if (!audioFiles.length) {
    alert('No supported audio files found. Please use MP3, M4A, OGG, WAV, etc.');
    return;
  }

  audioFiles.forEach(file => {
    const track = {
      id: uid(),
      name: file.name.replace(/\.[^/.]+$/, ''),
      artist: 'Unknown Artist',
      duration: 0,
      file: file
    };
    pl.tracks.push(track);

    // Get duration
    const tempUrl = URL.createObjectURL(file);
    const tempAudio = new Audio();
    tempAudio.src = tempUrl;
    tempAudio.addEventListener('loadedmetadata', () => {
      track.duration = tempAudio.duration;
      URL.revokeObjectURL(tempUrl);
      renderContent(searchInput.value);
      renderPlaylists();
    });
  });

  renderPlaylists();
  renderContent(searchInput.value);
  saveState();

  // Auto-play first added if nothing is playing
  if (currentIndex === -1 && pl.tracks.length) {
    playTrack(pl.tracks.length - audioFiles.length);
  }
}

// ===== Persistence (metadata only – files are session-based) =====
function saveState() {
  try {
    const data = {
      playlists: playlists.map(p => ({
        id: p.id,
        name: p.name,
        // We cannot persist File objects easily without IndexedDB.
        // Just keep the structure; user re-adds files each session.
        trackNames: p.tracks.map(t => ({ name: t.name, artist: t.artist, duration: t.duration }))
      })),
      currentPlaylistId
    };
    localStorage.setItem('worktunes-meta', JSON.stringify(data));
  } catch (e) {}
}

function loadState() {
  try {
    const raw = localStorage.getItem('worktunes-meta');
    if (!raw) return;
    const data = JSON.parse(raw);
    if (data.playlists && data.playlists.length) {
      // Restore playlist names only
      playlists = data.playlists.map(p => ({
        id: p.id,
        name: p.name,
        tracks: []
      }));
    }
    if (data.currentPlaylistId) currentPlaylistId = data.currentPlaylistId;
  } catch (e) {}
}

// ===== Event listeners =====
playBtn.addEventListener('click', togglePlay);
prevBtn.addEventListener('click', playPrev);
nextBtn.addEventListener('click', playNext);

shuffleBtn.addEventListener('click', () => {
  isShuffle = !isShuffle;
  shuffleBtn.classList.toggle('active', isShuffle);
});

repeatBtn.addEventListener('click', () => {
  repeatMode = (repeatMode + 1) % 3;
  repeatBtn.classList.toggle('active', repeatMode > 0);
  repeatBtn.title = repeatMode === 0 ? 'Repeat' : repeatMode === 1 ? 'Repeat All' : 'Repeat One';
  repeatBtn.textContent = repeatMode === 2 ? '①' : '↻';
});

addFilesBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', (e) => {
  if (e.target.files.length) addFiles(e.target.files);
  e.target.value = '';
});

newPlaylistBtn.addEventListener('click', () => {
  const name = prompt('Playlist name:', 'New Playlist');
  if (!name) return;
  const id = uid();
  playlists.push({ id, name: name.trim(), tracks: [] });
  currentPlaylistId = id;
  currentIndex = -1;
  renderPlaylists();
  renderContent();
  saveState();
});

playlistList.addEventListener('click', (e) => {
  const item = e.target.closest('.playlist-item');
  if (!item) return;
  currentPlaylistId = item.dataset.id;
  currentIndex = -1;
  isPlaying = false;
  audio.pause();
  audio.src = '';
  updatePlayButton();
  updateNowPlaying();
  renderPlaylists();
  renderContent(searchInput.value);
  saveState();
});

searchInput.addEventListener('input', () => {
  renderContent(searchInput.value);
});

// Progress bar
progressBar.addEventListener('click', (e) => {
  if (!audio.duration) return;
  const rect = progressBar.getBoundingClientRect();
  const pct = (e.clientX - rect.left) / rect.width;
  audio.currentTime = pct * audio.duration;
});

audio.addEventListener('timeupdate', () => {
  if (!audio.duration) return;
  const pct = (audio.currentTime / audio.duration) * 100;
  progressFill.style.width = pct + '%';
  progressHandle.style.left = pct + '%';
  currentTimeEl.textContent = formatTime(audio.currentTime);
  durationEl.textContent = formatTime(audio.duration);
});

audio.addEventListener('ended', () => {
  playNext();
});

audio.addEventListener('play', () => {
  isPlaying = true;
  updatePlayButton();
});

audio.addEventListener('pause', () => {
  isPlaying = false;
  updatePlayButton();
});

// Volume
audio.volume = volume;
volumeFill.style.width = (volume * 100) + '%';

volumeBar.addEventListener('click', (e) => {
  const rect = volumeBar.getBoundingClientRect();
  volume = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  audio.volume = volume;
  volumeFill.style.width = (volume * 100) + '%';
  muteBtn.textContent = volume === 0 ? '🔇' : '🔊';
});

muteBtn.addEventListener('click', () => {
  if (audio.volume > 0) {
    audio.dataset.prevVolume = audio.volume;
    audio.volume = 0;
    volumeFill.style.width = '0%';
    muteBtn.textContent = '🔇';
  } else {
    audio.volume = parseFloat(audio.dataset.prevVolume || 0.8);
    volumeFill.style.width = (audio.volume * 100) + '%';
    muteBtn.textContent = '🔊';
  }
});

likeBtn.addEventListener('click', () => {
  likeBtn.classList.toggle('liked');
  likeBtn.textContent = likeBtn.classList.contains('liked') ? '♥' : '♡';
});

// Drag & drop
document.body.addEventListener('dragover', (e) => {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';
});

document.body.addEventListener('drop', (e) => {
  e.preventDefault();
  if (e.dataTransfer.files.length) {
    addFiles(e.dataTransfer.files);
  }
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  switch (e.code) {
    case 'Space':
      e.preventDefault();
      togglePlay();
      break;
    case 'ArrowRight':
      playNext();
      break;
    case 'ArrowLeft':
      playPrev();
      break;
    case 'KeyM':
      muteBtn.click();
      break;
  }
});

// ===== Auto-load local music1.mp3 & music2.mp3 =====
async function loadBuiltinTracks() {
  const pl = playlists.find(p => p.id === 'opm') || playlists[0];

  for (const item of BUILTIN_TRACKS) {
    try {
      // Try to fetch the file from the same folder
      const response = await fetch(item.file, { method: 'HEAD' });
      if (!response.ok) continue; // file not found, skip silently

      // File exists – create a track entry that points to the local path
      const track = {
        id: uid(),
        name: item.name,
        artist: item.artist,
        duration: 0,
        src: item.file,          // direct path instead of File object
        isBuiltin: true
      };
      pl.tracks.push(track);

      // Get duration
      const tempAudio = new Audio(item.file);
      tempAudio.addEventListener('loadedmetadata', () => {
        track.duration = tempAudio.duration;
        renderContent(searchInput.value);
        renderPlaylists();
      });
    } catch (e) {
      // File not present – ignore
    }
  }

  renderPlaylists();
  renderContent();
}

// ===== Init =====
loadState();
renderPlaylists();
renderContent();
updateNowPlaying();
updatePlayButton();

// Try to load music1.mp3 and music2.mp3 automatically
loadBuiltinTracks().then(() => {
  console.log('WorkTunes ready. music1.mp3 / music2.mp3 will auto-load if present.');
});
