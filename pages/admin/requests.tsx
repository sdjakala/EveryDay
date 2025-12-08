import React, { useEffect, useState } from "react";
import Layout from "../../components/Layout";
import cookie from "cookie";
import jwt from "jsonwebtoken";

type RequestEntry = { email: string; name?: string; when?: string };

export default function AdminRequests(): React.ReactElement {
  const [requests, setRequests] = useState<RequestEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const url = "/api/admin/requests";
      const r = await fetch(url);
      if (!r.ok) throw new Error(await r.text());
      const j = await r.json();
      setRequests(j.requests || []);
    } catch (e: unknown) {
      setError((e && (e as any).message) || String(e));
    } finally {
      setLoading(false);
    }
  }

  async function approve(email: string) {
    if (!confirm(`Approve ${email}?`)) return;
    try {
      const url = "/api/admin/approve";
      const r = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });
      if (!r.ok) throw new Error(await r.text());
      await load();
    } catch (e: unknown) {
      setError((e && (e as any).message) || String(e));
    }
  }

  return (
    <Layout>
      <div className="container">
        <h1>Admin: Access Requests</h1>

        {error && <div style={{ color: "salmon" }}>{error}</div>}
        {loading && <div>Loading</div>}
        {!loading && requests.length === 0 && <div>No pending requests</div>}

        <div>
          {requests.map((r, i) => (
            <div key={i} className="module-card">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <div style={{ fontWeight: 700 }}>{r.email}</div>
                  <div style={{ color: "var(--muted)" }}>
                    {r.name} {" "}
                    <em style={{ color: "var(--muted)" }}>{r.when}</em>
                  </div>
                </div>
                <div>
                  <button
                    className="btn primary"
                    onClick={() => approve(r.email)}
                  >
                    Approve
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}

export async function getServerSideProps(context: any) {
  const req = context.req;
  try {
    const raw = req.headers.cookie || "";
    const parsed = cookie.parse(raw || "");
    const token = parsed.swa_session;
    if (!token) {
      return { redirect: { destination: "/", permanent: false } };
    }
    const payload = jwt.verify(token, process.env.SESSION_SECRET || "");
    const payloadAny = payload as any
    const email = (payloadAny && payloadAny.email) || "";
    const admins = (process.env.ADMIN_EMAILS || "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    if (!admins.includes(String(email).toLowerCase())) {
      return { redirect: { destination: "/", permanent: false } };
    }
    return { props: {} };
  } catch (e) {
    return { redirect: { destination: "/", permanent: false } };
  }
}