import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createSong, deleteSong, getSongs, patchSong } from "./api.js";
import { copyText } from "./copy.js";

export default function App() {
  const [songs, setSongs] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [mode, setMode] = useState(null); // null | "new" | "edit"
  const [detailOpen, setDetailOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => {
    getSongs().then(setSongs).catch((e) => setLoadError(e.message));
  }, []);

  useEffect(() => {
    document.body.classList.toggle("detail", detailOpen);
  }, [detailOpen]);

  const update = useCallback((id, changes) => {
    setSongs((list) => list.map((s) => (s.id === id ? { ...s, ...changes } : s)));
  }, []);

  // Reload order and details from the server, keeping lyrics/done typed or ticked locally
  const refresh = useCallback(async () => {
    const fresh = await getSongs();
    setSongs((prev) =>
      prev
        ? fresh.map((f) => {
            const old = prev.find((p) => p.id === f.id);
            return old ? { ...f, lyrics: old.lyrics, done: old.done } : f;
          })
        : fresh
    );
  }, []);

  const toggleDone = useCallback(
    async (id, current) => {
      update(id, { done: !current });
      try {
        await patchSong(id, { done: !current });
        setNotice("");
      } catch (e) {
        update(id, { done: current });
        setNotice("Not saved: " + e.message);
      }
    },
    [update]
  );

  const saveLyrics = useCallback(
    async (id, lyrics) => {
      await patchSong(id, { lyrics });
      update(id, { lyrics });
    },
    [update]
  );

  async function handleCreate(fields) {
    const row = await createSong(fields);
    await refresh();
    setSelectedId(row.id);
    setMode(null);
    setDetailOpen(true);
    setNotice("");
  }

  async function handleEdit(id, fields) {
    await patchSong(id, fields);
    await refresh();
    setMode(null);
  }

  async function handleDelete(id) {
    await deleteSong(id);
    setSongs((list) => list.filter((s) => s.id !== id));
    setSelectedId(null);
    setMode(null);
    setDetailOpen(false);
  }

  async function copyFromList(e, song) {
    e.stopPropagation();
    const ok = await copyText(song.lyrics);
    setNotice(ok ? "" : "Copy blocked. Open the song and select the text instead.");
    if (ok) {
      setCopiedId(song.id);
      setTimeout(() => setCopiedId((id) => (id === song.id ? null : id)), 1500);
    }
  }

  const visible = useMemo(() => {
    if (!songs) return [];
    const q = query.trim().toLowerCase();
    if (!q) return songs;
    return songs.filter((s) => `${s.title} ${s.artist} ${s.lyrics}`.toLowerCase().includes(q));
  }, [songs, query]);

  const setNames = useMemo(() => [...new Set((songs || []).map((s) => s.setName))], [songs]);
  const doneCount = songs ? songs.filter((s) => s.done).length : 0;
  const selected = songs && songs.find((s) => s.id === selectedId);

  const rows = [];
  let lastSet = "";
  visible.forEach((s) => {
    if (s.setName !== lastSet) {
      rows.push(<h2 key={"h-" + s.setName}>{s.setName}</h2>);
      lastSet = s.setName;
    }
    rows.push(
      <div
        key={s.id}
        className={"song" + (s.done ? " done" : "") + (s.id === selectedId && mode !== "new" ? " sel" : "")}
        onClick={() => {
          setSelectedId(s.id);
          setMode(null);
          setDetailOpen(true);
          window.scrollTo(0, 0);
        }}
      >
        <input
          type="checkbox"
          checked={s.done}
          aria-label={`Mark ${s.title} done`}
          onClick={(e) => e.stopPropagation()}
          onChange={() => toggleDone(s.id, s.done)}
        />
        <div className="t">
          <b>{s.title}</b>
          {s.artist && <small>{s.artist}</small>}
        </div>
        {s.lyrics.trim() && (
          <button
            className={"mini" + (copiedId === s.id ? " ok" : "")}
            onClick={(e) => copyFromList(e, s)}
            aria-label={`Copy lyrics of ${s.title}`}
          >
            {copiedId === s.id ? "Copied" : "Copy"}
          </button>
        )}
        <span className={"dot" + (s.lyrics ? " on" : "")} title={s.lyrics ? "Lyrics added" : "No lyrics yet"} />
      </div>
    );
  });

  let panel;
  if (mode === "new") {
    panel = (
      <SongForm
        key="new"
        heading="Add a song"
        submitLabel="Add song"
        initial={{ setName: selected ? selected.setName : "", title: "", artist: "", note: "" }}
        sets={setNames}
        onSubmit={handleCreate}
        onCancel={() => {
          setMode(null);
          if (!selected) setDetailOpen(false);
        }}
      />
    );
  } else if (mode === "edit" && selected) {
    panel = (
      <SongForm
        key={"edit-" + selected.id}
        heading="Edit details"
        submitLabel="Save changes"
        initial={selected}
        sets={setNames}
        onSubmit={(fields) => handleEdit(selected.id, fields)}
        onCancel={() => setMode(null)}
      />
    );
  } else if (selected) {
    panel = (
      <SongDetail
        key={selected.id}
        song={selected}
        onToggleDone={() => toggleDone(selected.id, selected.done)}
        onSave={saveLyrics}
        onEdit={() => setMode("edit")}
        onDelete={() => handleDelete(selected.id)}
        onBack={() => setDetailOpen(false)}
      />
    );
  } else {
    panel = <p className="empty">Pick a song to paste or read its lyrics, or add a new one.</p>;
  }

  return (
    <>
      <div className="app">
        <aside>
          <h1>UET Maseno 2026–2027 Worship Experience</h1>
          <p className="sub">Song checklist and lyrics</p>
          <div className="bar">
            <i style={{ width: songs && songs.length ? (doneCount / songs.length) * 100 + "%" : "0%" }} />
          </div>
          <div className="count">{songs ? `${doneCount} of ${songs.length} songs ready` : ""}</div>
          <button
            className="btn pri add"
            onClick={() => {
              setMode("new");
              setDetailOpen(true);
              window.scrollTo(0, 0);
            }}
          >
            Add song
          </button>
          <input
            className="search"
            type="search"
            placeholder="Find a song, artist or lyric"
            aria-label="Find a song"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {notice && <div className="status">{notice}</div>}
          {loadError ? (
            <p className="sub">Could not load songs: {loadError}. Check that the server and database are running.</p>
          ) : !songs ? (
            <p className="sub">Loading songs…</p>
          ) : rows.length ? (
            rows
          ) : (
            <p className="sub">{songs.length ? "No songs match. Try a different word." : "No songs yet. Use Add song."}</p>
          )}
        </aside>
        <main>{panel}</main>
      </div>
      <footer>Made by UET MIT</footer>
    </>
  );
}

function SongForm({ heading, submitLabel, initial, sets, onSubmit, onCancel }) {
  const [f, setF] = useState({
    setName: initial.setName,
    title: initial.title,
    artist: initial.artist,
    note: initial.note,
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const field = (key) => (e) => setF((v) => ({ ...v, [key]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    if (!f.title.trim() || !f.setName.trim()) {
      setError("Add a title and a set name.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onSubmit(f);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button className="back" onClick={onCancel}>Back</button>
      <form className="form" onSubmit={submit}>
        <h3>{heading}</h3>
        <label>
          Set
          <input list="set-names" value={f.setName} onChange={field("setName")} placeholder="For example: Set 1 – Worship" />
          <datalist id="set-names">
            {sets.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </label>
        <label>
          Title
          <input value={f.title} onChange={field("title")} />
        </label>
        <label>
          Artist
          <input value={f.artist} onChange={field("artist")} />
        </label>
        <label>
          Note (timestamps, key, cues)
          <input value={f.note} onChange={field("note")} />
        </label>
        <div className="err">{error}</div>
        <div className="row">
          <button type="submit" className="btn pri" disabled={busy}>{busy ? "Saving…" : submitLabel}</button>
          <button type="button" className="btn" onClick={onCancel}>Cancel</button>
        </div>
      </form>
    </>
  );
}

function SongDetail({ song, onToggleDone, onSave, onEdit, onDelete, onBack }) {
  const [text, setText] = useState(song.lyrics);
  const [stage, setStage] = useState(false);
  const [status, setStatus] = useState("");
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const saved = useRef(song.lyrics);
  const latest = useRef(text);
  latest.current = text;

  const save = useCallback(async () => {
    const value = latest.current;
    if (value === saved.current) return;
    setStatus("Saving…");
    try {
      await onSave(song.id, value);
      saved.current = value;
      setStatus("Saved");
    } catch (e) {
      setStatus("Not saved: " + e.message);
    }
  }, [song.id, onSave]);

  useEffect(() => {
    setText(song.lyrics);
    saved.current = song.lyrics;
    setStatus("");
  }, [song.id, song.lyrics]);

  // Autosave shortly after typing stops
  useEffect(() => {
    if (text === saved.current) return;
    const t = setTimeout(save, 700);
    return () => clearTimeout(t);
  }, [text, save]);

  // Save anything pending when switching songs
  useEffect(() => () => { save(); }, [save]);

  async function copy() {
    const ok = await copyText(text);
    if (ok) {
      setCopied(true);
      setStatus("");
      setTimeout(() => setCopied(false), 1500);
    } else {
      setStatus("Copy blocked. Select the text and copy it manually.");
    }
  }

  async function remove() {
    try {
      await onDelete();
    } catch (e) {
      setConfirming(false);
      setStatus("Not deleted: " + e.message);
    }
  }

  const hasLyrics = text.trim().length > 0;

  return (
    <>
      <button className="back" onClick={onBack}>Back to list</button>
      <div className="head">
        <h3>{song.title}</h3>
        {song.artist && <p>{song.artist}</p>}
        {song.note && <span className="note">{song.note}</span>}
      </div>
      <div className="tools">
        <button className={"btn" + (song.done ? " ok" : "")} onClick={onToggleDone}>
          {song.done ? "Marked ready" : "Mark as ready"}
        </button>
        {hasLyrics && (
          <button className={"btn" + (copied ? " ok" : "")} onClick={copy}>
            {copied ? "Copied" : "Copy lyrics"}
          </button>
        )}
        <button className="btn" onClick={() => setStage((v) => !v)}>
          {stage ? "Edit lyrics" : "Stage view"}
        </button>
        {!stage && <button className="btn pri" onClick={save}>Save lyrics</button>}
        <button className="btn" onClick={onEdit}>Edit details</button>
        {confirming ? (
          <>
            <button className="btn danger" onClick={remove}>Confirm delete</button>
            <button className="btn" onClick={() => setConfirming(false)}>Keep song</button>
          </>
        ) : (
          <button className="btn danger" onClick={() => setConfirming(true)}>Delete song</button>
        )}
      </div>
      <div className="status">{status}</div>
      {stage ? (
        <div className="stage">{text || "No lyrics saved yet."}</div>
      ) : (
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste the lyrics here"
          aria-label="Lyrics"
        />
      )}
    </>
  );
}
