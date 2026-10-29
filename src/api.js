import axios from "axios";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

let code = "";
try {
  code = localStorage.getItem("wcode") || "";
} catch {}

function resolveUrl(path) {
  if (!path) return API_BASE || "/";
  if (/^https?:\/\//.test(path)) return path;
  return `${API_BASE}${path}`;
}

async function request(path, options = {}) {
  const res = await axios(resolveUrl(path), {
    ...options,
    validateStatus: () => true,
    headers: {
      "Content-Type": "application/json",
      "x-access-code": code,
      ...(options.headers || {}),
    },
  });
  if (res.status === 401) {
    const entered = window.prompt("Enter the team access code");
    if (!entered) throw new Error("Access code needed");
    code = entered;
    try {
      localStorage.setItem("wcode", entered);
    } catch {}
    return request(path, options);
  }
  if (res.status >= 400) {
    let message = `Server error ${res.status}`;
    try {
      const body = res.data;
      if (body && body.error) message = body.error;
    } catch {}
    throw new Error(message);
  }
  return res.data;
}

export const getSongs = () => request("/api/songs");

export const createSong = (data) =>
  request("/api/songs", { method: "POST", data });

export const patchSong = (id, data) =>
  request(`/api/songs/${id}`, { method: "PATCH", data });

export const deleteSong = (id) => request(`/api/songs/${id}`, { method: "DELETE" });
