import api from "../api/client.js";

// Downloads a protected API endpoint's response as a file, attaching the JWT via
// the shared axios instance — a plain <a href>/window.open can't set auth headers.
export async function downloadFile(url, filename) {
  const res = await api.get(url, { responseType: "blob" });
  const blobUrl = window.URL.createObjectURL(res.data);
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(blobUrl);
}
