import fs from "fs";
import path from "path";

const filePath = path.join(process.cwd(), "data", "allowlist.json");

function readFile() {
  try {
    const txt = fs.readFileSync(filePath, "utf8");
    return JSON.parse(txt);
  } catch (e) {
    return { allowed: [], requests: [] };
  }
}

function writeFile(data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

export async function checkAllowlist(email) {
  const data = readFile();
  // if allowed is empty, allow all (convenience for dev)
  if (!data.allowed || data.allowed.length === 0) return true;
  return data.allowed.includes(email);
}

export async function createAccessRequest(payload) {
  const data = readFile();
  data.requests = data.requests || [];
  data.requests.push({
    email: payload.email,
    name: payload.name,
    when: new Date().toISOString(),
  });
  writeFile(data);
}

export async function listRequests() {
  const data = readFile();
  return data.requests || [];
}

export async function approve(email) {
  const data = readFile();
  data.allowed = data.allowed || [];
  if (!data.allowed.includes(email)) data.allowed.push(email);
  data.requests = (data.requests || []).filter((r) => r.email !== email);
  writeFile(data);
}

export async function clearEverything() {
  writeFile({ allowed: [], requests: [] });
}
