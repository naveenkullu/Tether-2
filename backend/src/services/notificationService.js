import { Resend } from 'resend';
import GuardianNotificationLog from '../models/GuardianNotificationLog.js';
import RiskSnapshot from '../models/RiskSnapshot.js';
import User from '../models/User.js';
import {
    generateSituationAnalysis,
    generateIncidentSummary
} from "./aiService.js";

const DEFAULT_COOLDOWN_MS = 5 * 60 * 1000;
const SIGNIFICANT_RISK_DROP = 15;
const RISK_ORDER = { Low: 0, Medium: 1, High: 2, Critical: 3 };
const DEFAULT_FROM = 'Tether <onboarding@resend.dev>';

const notificationCooldownMs = () =>
  Number(process.env.GUARDIAN_NOTIFICATION_COOLDOWN_MS || DEFAULT_COOLDOWN_MS);

function shouldSkipForCooldown(lastLog) {
  if (!lastLog) return false;
  return Date.now() - new Date(lastLog.createdAt).getTime() < notificationCooldownMs();
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatDate(value) {
  if (!value) return 'Not available';
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function formatDuration(start, end) {
  if (!start || !end) return 'Not available';
  const totalMinutes = Math.max(0, Math.round((new Date(end) - new Date(start)) / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function normalizeLocation(location = {}) {
  const latitude = location.latitude ?? location.lat;
  const longitude = location.longitude ?? location.lng;
  const normalized = {
    latitude: Number(latitude),
    longitude: Number(longitude),
  };
  if (!Number.isFinite(normalized.latitude) || !Number.isFinite(normalized.longitude)) {
    return { latitude: 'Unavailable', longitude: 'Unavailable' };
  }
  return normalized;
}

function finiteLocation(location = {}) {
  const latitude = location.latitude ?? location.lat;
  const longitude = location.longitude ?? location.lng;
  return {
    latitude: Number(latitude),
    longitude: Number(longitude),
  };
}

function mapsLink(location) {
  const { latitude, longitude } = finiteLocation(location);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return '#';
  return `https://www.google.com/maps?q=${latitude},${longitude}`;
}

function riskColor(risk = 'Low') {
  return {
    Low: '#18a058',
    Medium: '#d9a21b',
    High: '#f97316',
    Critical: '#dc2626',
  }[risk] || '#18a058';
}

function normalizeGuardians(guardians = []) {
  const ids = [];
  const recipients = [];

  for (const guardian of guardians) {
    if (!guardian) continue;

    if (typeof guardian === 'object') {
      if (guardian.id?.match?.(/^[a-f\d]{24}$/i)) ids.push(guardian.id);
      if (guardian._id?.toString?.().match?.(/^[a-f\d]{24}$/i)) ids.push(String(guardian._id));
      if (guardian.email) {
        recipients.push({
          name: guardian.name || 'Guardian',
          email: String(guardian.email).trim(),
        });
      }
      continue;
    }

    if (String(guardian).match(/^[a-f\d]{24}$/i)) ids.push(String(guardian));
  }

  // Always include primary alert email (warp639@gmail.com) so account owner receives notifications
  const primaryEmail = process.env.PRIMARY_ALERT_EMAIL || 'warp639@gmail.com';
  recipients.push({ name: 'Primary Guardian', email: primaryEmail });

  const seen = new Set();
  const uniqueRecipients = recipients.filter((recipient) => {
    const email = recipient.email.toLowerCase();
    if (!email || seen.has(email)) return false;
    seen.add(email);
    return true;
  });

  return { ids, recipients: uniqueRecipients };
}

function weatherText(weather) {
  if (!weather) return 'Not available';
  if (typeof weather === 'string') return weather;
  return weather.summary || weather.condition || JSON.stringify(weather);
}

function placeName(places = []) {
  if (!Array.isArray(places) || places.length === 0) return 'Not available';
  const sorted = [...places].sort((a, b) => Number(a.distanceKm ?? 999) - Number(b.distanceKm ?? 999));
  const place = sorted[0];
  const distance = Number.isFinite(Number(place.distanceKm)) ? ` (${place.distanceKm} km)` : '';
  return `${place.name || place.type || 'Nearby place'}${distance}`;
}

function safePlacesText(places = []) {
  if (!Array.isArray(places) || places.length === 0) return 'None reported';
  return places
    .slice(0, 4)
    .map((place) => place.name || place.type || 'Safe place')
    .join(', ');
}

function aiInsightText(snapshot, fallback = 'Tether is monitoring the walk in real time.') {
  const insight = snapshot?.aiInsight;
  if (!insight) return fallback;
  if (typeof insight === 'string') return insight;
  return insight.message || insight.summary || fallback;
}

async function reverseGeocode(location) {
  const { latitude, longitude } = finiteLocation(location);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return 'Location unavailable';

  try {
    const params = new URLSearchParams({
      format: 'jsonv2',
      lat: String(latitude),
      lon: String(longitude),
      zoom: '16',
      addressdetails: '1',
    });
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params.toString()}`, {
      headers: {
        'User-Agent': process.env.GEOCODING_USER_AGENT || 'Tether/1.0 (safe-walk-monitoring)',
      },
    });
    if (!response.ok) throw new Error(`Reverse geocoding failed with ${response.status}`);
    const data = await response.json();
    const address = data.address || {};
    return [
      address.neighbourhood || address.suburb || address.quarter || address.road,
      address.city || address.town || address.village || address.county,
      address.state,
    ].filter(Boolean).slice(0, 3).join(', ') || data.display_name || `${latitude}, ${longitude}`;
  } catch (error) {
    console.warn('[Tether] Reverse geocoding failed:', error.message);
    return `${latitude}, ${longitude}`;
  }
}

async function persistArea(session, snapshot, area, type) {
  if (snapshot && !snapshot.readableLocation) {
    snapshot.readableLocation = area;
    await snapshot.save();
  }

  if (type === 'SAFE_WALK_STARTED' && !session.startArea) {
    session.startArea = area;
    await session.save();
  }

  if (type === 'MONITORING_ENDED' && !session.endArea) {
    session.endArea = area;
    await session.save();
  }
}

async function buildPayload(type, session, snapshot, extra = {}) {
  const user = await User.findById(session.user).lean();
  const location = normalizeLocation(
    snapshot?.location ?? extra.location ?? session.endLocation ?? session.startLocation,
  );
  const area =
    snapshot?.readableLocation ||
    extra.area ||
    session.endArea ||
    session.startArea ||
    await reverseGeocode(location);

  await persistArea(session, snapshot, area, type);

  return {
    type,
    userId: String(session.user),
    userName: user?.name || 'Tether user',
    userEmail: user?.email,
    userPhone: user?.phone || 'Not provided',
    sessionId: String(session._id),
    risk: snapshot?.risk ?? extra.currentRiskLevel ?? session.lastRiskLevel,
    score: snapshot?.score ?? extra.currentSafeScore ?? session.lastRiskScore,
    previousScore: extra.previousScore,
    location,
    area,
    mapsUrl: mapsLink(location),
    reasons: snapshot?.reasons ?? [],
    aiInsight: aiInsightText(snapshot, extra.aiInsight?.message || extra.message || extra.aiInsight),
    weather: weatherText(snapshot?.weather ?? extra.weather),
    dayNight: snapshot?.dayNight || extra.dayNight || 'unknown',
    batteryLevel: snapshot?.batteryLevel ?? extra.batteryLevel ?? 'Not available',
    nearbySafePlaces: snapshot?.nearbySafePlaces ?? extra.nearbySafePlaces ?? [],
    nearestPoliceStation: placeName(snapshot?.nearbyPoliceStations ?? extra.nearbyPoliceStations),
    nearestHospital: placeName(snapshot?.nearbyHospitals ?? extra.nearbyHospitals),
    startTime: session.startedAt,
    endTime: session.endedAt,
    duration: formatDuration(session.startedAt, session.endedAt),
    timestamp: new Date().toISOString(),
    walkingSpeedKmph: extra.walkingSpeedKmph,
    recommendation: extra.recommendation,
    ...extra,
  };
}

function subjectFor(type, payload) {
  if (type === 'SOS') return '🚨 EMERGENCY SOS ACTIVATED';
  if (type === 'MONITORING_ENDED') return '✅ Safe Walk Completed';
  if (type === 'RISK_INCREASED' || type === 'HIGH_RISK') {
    return `Tether risk update: ${payload.risk} risk`;
  }
  return `Tether Safe Walk started for ${payload.userName}`;
}

function stat(label, value) {
  return `
    <div style="background:#ffffff;border:1px solid #dbeafe;border-radius:16px;padding:14px;">
      <div style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:.06em;">${escapeHtml(label)}</div>
      <div style="font-size:18px;color:#0f172a;font-weight:800;margin-top:4px;">${escapeHtml(value)}</div>
    </div>
  `;
}

function emailHtml(type, payload) {
  const color = riskColor(payload.risk);
  const location = normalizeLocation(payload.location);
  const title = {
    SAFE_WALK_STARTED: 'Safe Walk Started',
    RISK_INCREASED: 'Risk Increased',
    HIGH_RISK: 'High Risk Alert',
    SOS: 'Emergency SOS Activated',
    MONITORING_ENDED: 'Safe Walk Completed',
  }[type];

  const reasons = payload.reasons?.length
    ? payload.reasons.map((reason) => `<li>${escapeHtml(reason)}</li>`).join('')
    : '<li>No risk reasons reported.</li>';

  return `
  <!doctype html>
  <html>
    <body style="margin:0;background:#eef6ff;font-family:Inter,Arial,sans-serif;color:#0f172a;">
      <div style="max-width:680px;margin:0 auto;padding:28px 14px;">
        <div style="background:linear-gradient(135deg,#0f3b57,#0f766e);border-radius:28px 28px 0 0;padding:30px;color:#fff;">
          <div style="font-size:13px;letter-spacing:.16em;text-transform:uppercase;opacity:.78;">Tether</div>
          <h1 style="margin:10px 0 0;font-size:30px;line-height:1.15;">${escapeHtml(title)}</h1>
          <p style="margin:10px 0 0;color:#d7fffb;">Real-time Safe Walk notification for ${escapeHtml(payload.userName)}</p>
        </div>

        <div style="background:#f8fbff;border:1px solid #cfe5ff;border-top:0;border-radius:0 0 28px 28px;padding:26px;">
          <div style="display:inline-block;background:${color};color:#fff;border-radius:999px;padding:8px 14px;font-weight:800;margin-bottom:18px;">
            ${escapeHtml(payload.risk)} Risk
          </div>

          <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-bottom:18px;">
            ${stat('Safe Score', String(payload.score ?? 'Not available'))}
            ${stat('Area', payload.area)}
            ${stat('Weather', payload.weather)}
            ${stat('Day/Night', payload.dayNight)}
            ${stat('Battery', payload.batteryLevel === 'Not available' ? payload.batteryLevel : `${payload.batteryLevel}%`)}
            ${stat('Time', formatDate(payload.timestamp))}
          </div>

          <div style="background:#fff;border:1px solid #dbeafe;border-radius:20px;padding:18px;margin-bottom:18px;">
            <h2 style="margin:0 0 8px;font-size:18px;">AI Insight</h2>
            <p style="margin:0;color:#334155;line-height:1.55;">${escapeHtml(payload.aiSituation)}</p>
          </div>

          <div style="background:#fff;border:1px solid #dbeafe;border-radius:20px;padding:18px;margin-bottom:18px;">
            <h2 style="margin:0 0 8px;font-size:18px;">Location</h2>
            <p style="margin:0 0 8px;color:#334155;">Latitude: ${escapeHtml(location.latitude)}<br>Longitude: ${escapeHtml(location.longitude)}</p>
            <a href="${escapeHtml(payload.mapsUrl)}" style="display:block;text-align:center;background:linear-gradient(135deg,#0ea5e9,#14b8a6);color:#fff;text-decoration:none;border-radius:16px;padding:16px 22px;font-size:18px;font-weight:900;margin-top:14px;">
              📍 Track Live Location
            </a>
          </div>

          <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-bottom:18px;">
            ${stat('Nearest Police', payload.nearestPoliceStation)}
            ${stat('Nearest Hospital', payload.nearestHospital)}
          </div>

          <div style="background:#fff;border:1px solid #dbeafe;border-radius:20px;padding:18px;margin-bottom:18px;">
            <h2 style="margin:0 0 8px;font-size:18px;">Nearby Safe Places</h2>
            <p style="margin:0;color:#334155;">${escapeHtml(safePlacesText(payload.nearbySafePlaces))}</p>
          </div>

          <div style="background:#fff;border:1px solid #dbeafe;border-radius:20px;padding:18px;">
            <h2 style="margin:0 0 8px;font-size:18px;">Risk Reasons</h2>
            <ul style="margin:0;padding-left:20px;color:#334155;line-height:1.6;">${reasons}</ul>
          </div>

          ${type === 'MONITORING_ENDED' ? `
            <div style="background:#ecfdf5;border:1px solid #bbf7d0;border-radius:20px;padding:18px;margin-top:18px;">
              <h2 style="margin:0 0 8px;font-size:18px;">
              Session Summary
              </h2>

              <p style="line-height:1.7;color:#14532d;">

              ${escapeHtml(payload.aiInsight)}

              <br><br>

              <b>Recommendation</b>

              <br>

              ${escapeHtml(payload.recommendation)}

              </p>
            </div>
          ` : ''}

          ${type === 'SOS' ? `
            <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:20px;padding:18px;margin-top:18px;">
              <h2 style="margin:0 0 8px;font-size:18px;color:#991b1b;">Emergency Contact Details</h2>
              <p style="margin:0;color:#7f1d1d;line-height:1.55;">
                User: ${escapeHtml(payload.userName)}<br>
                Phone: ${escapeHtml(payload.userPhone)}<br>
                Email: ${escapeHtml(payload.userEmail || 'Not available')}
              </p>
            </div>
          ` : ''}
        </div>
      </div>
    </body>
  </html>
  `;
}

function plainText(type, payload) {
  const location = normalizeLocation(payload.location);
  return `${subjectFor(type, payload)}

User: ${payload.userName}
Score: ${payload.score}
Risk: ${payload.risk}
Area: ${payload.area}
Latitude: ${location.latitude}
Longitude: ${location.longitude}
Maps: ${payload.mapsUrl}
Insight: ${payload.aiInsight}
Weather: ${payload.weather}
Nearest police: ${payload.nearestPoliceStation}
Nearest hospital: ${payload.nearestHospital}
Time: ${formatDate(payload.timestamp)}
`;
}

async function logNotification({ session, type, guardianIds = [], payload, status = 'queued', error }) {
  return GuardianNotificationLog.create({
    session: session._id,
    user: session.user,
    guardians: guardianIds,
    type,
    payload,
    deliveryStatus: status,
    channel: 'email',
    cooldownKey: `${session._id}:${type}`,
    sentAt: status === 'sent' ? new Date() : undefined,
    error,
  });
}

async function sendEmail(type, recipients, payload) {
  if (recipients.length === 0) {
    recipients = [{ name: 'Primary Guardian', email: 'warp639@gmail.com' }];
  }

  const apiKey = process.env.RESEND_API_KEY || process.env.VITE_RESEND_API_KEY;
  if (!apiKey) {
    return { status: 'failed', error: 'RESEND_API_KEY is not configured.' };
  }

  const resend = new Resend(apiKey);
  const targetEmails = ["warp639@gmail.com"];

  const { data, error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL || DEFAULT_FROM,
    to: targetEmails,
    subject: subjectFor(type, payload),
    html: emailHtml(type, payload),
    text: plainText(type, payload),
  });

  if (error) {
    console.warn('[Resend Email Warning]', error);
    // If error is due to testing email restriction (onboarding@resend.dev limit), retry sending specifically to warp639@gmail.com
    if (JSON.stringify(error).includes('warp639@gmail.com') || JSON.stringify(error).includes('testing emails')) {
      const retryResult = await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || DEFAULT_FROM,
        to: ['warp639@gmail.com'],
        subject: subjectFor(type, payload),
        html: emailHtml(type, payload),
        text: plainText(type, payload),
      });
      if (!retryResult.error) {
        return { status: 'sent', resendId: retryResult.data?.id };
      }
    }
    return { status: 'failed', error: error.message || JSON.stringify(error) };
  }

  return { status: 'sent', resendId: data?.id };
}

async function notify({ session, snapshot, type, guardians = [], extra = {}, force = false }) {
  const { ids, recipients } = normalizeGuardians(guardians);
  const payload = await buildPayload(type, session, snapshot, {
    ...extra,
    guardianRecipients: recipients.map((recipient) => recipient.email),
  });
payload.aiSituation = await generateSituationAnalysis({

    risk: payload.risk,

    score: payload.score,

    area: payload.area,

    weather: payload.weather,

    battery: payload.batteryLevel,

    dayNight: payload.dayNight,

    speed: payload.walkingSpeedKmph,

    police: payload.nearestPoliceStation,

    hospital: payload.nearestHospital,

    reasons: payload.reasons

});

  const lastLog = await GuardianNotificationLog.findOne({
    session: session._id,
    type,
    deliveryStatus: { $ne: 'skipped' },
  }).sort({ createdAt: -1 });

  if (!force && shouldSkipForCooldown(lastLog)) {
    return logNotification({ session, type, guardianIds: ids, payload, status: 'skipped', error: 'Cooldown active.' });
  }

  const result = await sendEmail(type, recipients, payload);
  return logNotification({
    session,
    type,
    guardianIds: ids,
    payload: { ...payload, resendId: result.resendId },
    status: result.status,
    error: result.error,
  });
}

async function previousSnapshotFor(snapshot) {
  if (!snapshot?._id) return null;
  return RiskSnapshot.findOne({
    session: snapshot.session,
    _id: { $ne: snapshot._id },
    capturedAt: { $lte: snapshot.capturedAt },
  }).sort({ capturedAt: -1 });
}

function didRiskIncrease(previous, current) {
  if (!previous) return false;
  return (RISK_ORDER[current?.risk] ?? 0) > (RISK_ORDER[previous?.risk] ?? 0);
}

export async function notifySafeWalkStarted(session, guardians = [], startContext = {}) {
  return notify({
    session,
    guardians,
    type: 'SAFE_WALK_STARTED',
    extra: {
      ...startContext,
      location: startContext.location ?? session.startLocation,
      message: startContext.aiInsight?.message || 'Safe Walk monitoring started.',
      weather: weatherText(startContext.weather),
      dayNight: startContext.dayNight,
    },
    force: true,
  });
}

export async function notifyMonitoringEnded(session, guardians = []) {

    const finalSnapshot =
        await RiskSnapshot.findOne({
            session: session._id
        }).sort({ capturedAt: -1 });

    const summary =
        await generateIncidentSummary({

            duration:
                formatDuration(session.startedAt, session.endedAt),

            highestRisk:
                finalSnapshot?.risk,

            finalScore:
                finalSnapshot?.score,

            area:
                finalSnapshot?.readableLocation,

            events:
                finalSnapshot?.reasons || []

        });

    return notify({

        session,

        snapshot: finalSnapshot,

        guardians,

        type: "MONITORING_ENDED",

        extra: {

            message: summary.summary,

            recommendation: summary.recommendation

        },

        force: true

    });

}

export async function notifyRiskChange({ session, snapshot, previousScore, guardians = [] }) {
  const notifications = [];
  const scoreDrop = Number(previousScore) - Number(snapshot.score);
  const previousSnapshot = await previousSnapshotFor(snapshot);
  const levelIncreased = didRiskIncrease(previousSnapshot, snapshot);

  if (snapshot.isSos) {
    notifications.push(await notify({
      session,
      snapshot,
      guardians,
      type: 'SOS',
      extra: { message: 'SOS was triggered during Safe Walk.' },
      force: true,
    }));
  }

  if (scoreDrop >= SIGNIFICANT_RISK_DROP || levelIncreased) {
    notifications.push(await notify({
      session,
      snapshot,
      guardians,
      type: 'RISK_INCREASED',
      extra: { message: 'Safe Walk risk increased significantly.', previousScore },
    }));
  }

  if (snapshot.risk === 'High' || snapshot.risk === 'Critical') {
    notifications.push(await notify({
      session,
      snapshot,
      guardians,
      type: 'HIGH_RISK',
      extra: { message: 'Safe Walk is currently high risk.' },
    }));
  }

  return notifications;
}
