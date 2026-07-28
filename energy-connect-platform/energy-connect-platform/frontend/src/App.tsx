import React, { useEffect, useState } from "react";

type Device = {
  id: string;
  provider: string;
  externalId: string;
  kind: string;
  status: string;
  batteryPct: number | null;
  charging: boolean | null;
};

type Slo = {
  successRate: number;
  p95Ms: number;
  successObjectiveMet: boolean;
  latencyObjectiveMet: boolean;
};

const API = import.meta.env.VITE_API_URL ?? "http://localhost:8080";

export function App() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [slo, setSlo] = useState<Slo | null>(null);
  const [error, setError] = useState("");

  async function refresh() {
    try {
      const [deviceRes, sloRes] = await Promise.all([
        fetch(`${API}/v1/devices`),
        fetch(`${API}/v1/ops/slo`),
      ]);
      const deviceJson = await deviceRes.json();
      setDevices(deviceJson.devices ?? []);
      setSlo(await sloRes.json());
      setError("");
    } catch (e) {
      setError(String(e));
    }
  }

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), 5000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <main className="shell">
      <header>
        <p className="eyebrow">Energy Connect Platform</p>
        <h1>Operations Dashboard</h1>
        <p>Internal React tooling for integration monitoring, SLO health and troubleshooting.</p>
      </header>

      {error && <section className="card danger"><strong>API unavailable:</strong> {error}</section>}

      <section className="grid">
        <article className="card">
          <span>Success rate</span>
          <strong>{slo ? `${(slo.successRate * 100).toFixed(3)}%` : "-"}</strong>
          <small>{slo?.successObjectiveMet ? "SLO healthy" : "SLO at risk"}</small>
        </article>
        <article className="card">
          <span>p95 latency</span>
          <strong>{slo ? `${slo.p95Ms} ms` : "-"}</strong>
          <small>{slo?.latencyObjectiveMet ? "Within objective" : "Above objective"}</small>
        </article>
        <article className="card">
          <span>Connected devices</span>
          <strong>{devices.length}</strong>
          <small>Across simulated OEM integrations</small>
        </article>
      </section>

      <section className="card">
        <div className="row"><h2>Devices</h2><button onClick={() => void refresh()}>Refresh</button></div>
        <table>
          <thead><tr><th>Device</th><th>Provider</th><th>Kind</th><th>Status</th><th>Battery</th><th>Charging</th></tr></thead>
          <tbody>
            {devices.map((device) => (
              <tr key={device.id}>
                <td>{device.externalId}</td><td>{device.provider}</td><td>{device.kind}</td>
                <td>{device.status}</td><td>{device.batteryPct ?? "-"}</td><td>{String(device.charging ?? "-")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
