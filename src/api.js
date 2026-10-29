let code = "";
try {
  code = localStorage.getItem("wcode") || "";
} catch {}

async function request(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", "x-access-code": code },
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
  if (!res.ok) {
    let message = `Server error ${res.status}`;
    try {
      const body = await res.json();
      if (body.error) message = body.error;
    } catch {}
    throw new Error(message);
  }
  return res.json();
}

export const getSongs = () => request("/api/songs");

export const createSong = (data) =>
  request("/api/songs", { method: "POST", body: JSON.stringify(data) });

export const patchSong = (id, data) =>
  request(`/api/songs/${id}`, { method: "PATCH", body: JSON.stringify(data) });

export const deleteSong = (id) => request(`/api/songs/${id}`, { method: "DELETE" });
