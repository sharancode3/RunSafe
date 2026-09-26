import type { FastifyPluginAsync } from "fastify";
import { getControlPlaneDb } from "@runsafe/shared";

export const eventRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/v1/events (JSON snapshot)
  fastify.get("/api/v1/events", async (request, reply) => {
    const query = request.query as any;
    const incidentId = query?.incidentId;
    const limit = query?.limit ? parseInt(query.limit, 10) : 100;

    const db = getControlPlaneDb();
    let rows: any[];
    if (incidentId) {
      rows = db
        .prepare("SELECT * FROM incident_events WHERE incident_id = ? ORDER BY created_at ASC LIMIT ?")
        .all(incidentId, limit) as any[];
    } else {
      rows = db
        .prepare("SELECT * FROM incident_events ORDER BY created_at DESC LIMIT ?")
        .all(limit) as any[];
    }

    const events = rows.map((r) => ({
      id: r.id,
      incidentId: r.incident_id,
      eventType: r.event_type,
      payload: JSON.parse(r.payload || "{}"),
      createdAt: r.created_at,
    }));

    return reply.status(200).send({
      events,
      count: events.length,
    });
  });

  // GET /api/v1/events/stream (Server-Sent Events)
  fastify.get("/api/v1/events/stream", async (request, reply) => {
    const query = request.query as any;
    const incidentId = query?.incidentId;

    reply.raw.setHeader("Content-Type", "text/event-stream");
    reply.raw.setHeader("Cache-Control", "no-cache, no-transform");
    reply.raw.setHeader("Connection", "keep-alive");
    reply.raw.setHeader("Access-Control-Allow-Origin", "*");
    reply.raw.flushHeaders();

    const db = getControlPlaneDb();
    let lastSeenTime = new Date(Date.now() - 3600000).toISOString(); // Last 1 hour initially

    // Send initial snapshot
    let initialRows: any[];
    if (incidentId) {
      initialRows = db
        .prepare("SELECT * FROM incident_events WHERE incident_id = ? ORDER BY created_at ASC")
        .all(incidentId) as any[];
    } else {
      initialRows = db
        .prepare("SELECT * FROM incident_events ORDER BY created_at DESC LIMIT 50")
        .all() as any[];
      initialRows.reverse();
    }

    for (const r of initialRows) {
      const evt = {
        id: r.id,
        incidentId: r.incident_id,
        eventType: r.event_type,
        payload: JSON.parse(r.payload || "{}"),
        createdAt: r.created_at,
      };
      reply.raw.write(`event: incident_event\ndata: ${JSON.stringify(evt)}\n\n`);
      if (r.created_at > lastSeenTime) {
        lastSeenTime = r.created_at;
      }
    }

    // Interval to poll for new events and keep connection alive
    const interval = setInterval(() => {
      try {
        let newRows: any[];
        if (incidentId) {
          newRows = db
            .prepare("SELECT * FROM incident_events WHERE incident_id = ? AND created_at > ? ORDER BY created_at ASC")
            .all(incidentId, lastSeenTime) as any[];
        } else {
          newRows = db
            .prepare("SELECT * FROM incident_events WHERE created_at > ? ORDER BY created_at ASC")
            .all(lastSeenTime) as any[];
        }

        for (const r of newRows) {
          const evt = {
            id: r.id,
            incidentId: r.incident_id,
            eventType: r.event_type,
            payload: JSON.parse(r.payload || "{}"),
            createdAt: r.created_at,
          };
          reply.raw.write(`event: incident_event\ndata: ${JSON.stringify(evt)}\n\n`);
          if (r.created_at > lastSeenTime) {
            lastSeenTime = r.created_at;
          }
        }

        // Heartbeat comment
        reply.raw.write(": keepalive\n\n");
      } catch (err) {
        // Ignored if client disconnected
      }
    }, 1500);

    request.raw.on("close", () => {
      clearInterval(interval);
    });
  });
};
