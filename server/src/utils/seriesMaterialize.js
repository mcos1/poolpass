import { Job } from "../models/Job.js";
import { JobSeries } from "../models/JobSeries.js";

const MS_DAY = 24 * 60 * 60 * 1000;
const DEFAULT_WEEKS = 12;

function startOfUtcDay(d) {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

function combineUtcDateAndTime(dateUtcMidnight, hour, minute) {
  const out = new Date(dateUtcMidnight);
  out.setUTCHours(hour, minute, 0, 0);
  return out;
}

function addDays(d, n) {
  return new Date(d.getTime() + n * MS_DAY);
}

/**
 * @param {import("../models/JobSeries.js").JobSeries} series
 * @param {Date} fromDate inclusive (UTC day start used for iteration anchor)
 * @param {Date} untilDate exclusive upper bound for instance starts
 */
export async function materializeSeriesInstances(series, fromDate, untilDate) {
  const from = startOfUtcDay(fromDate);
  const until = new Date(untilDate);
  const docs = [];

  const weekdays = series.recurrence.byWeekday?.length
    ? series.recurrence.byWeekday
    : [1];

  for (let d = new Date(from); d < until; d = addDays(d, 1)) {
    const wd = d.getUTCDay();
    if (!weekdays.includes(wd)) continue;

    const start = combineUtcDateAndTime(d, series.startTimeHour, series.startTimeMinute);
    const end = new Date(start.getTime() + series.durationMinutes * 60 * 1000);
    if (start < fromDate) continue;
    if (start >= until) break;
    if (series.recurrence.until && start > series.recurrence.until) continue;

    docs.push({
      title: series.title,
      description: series.description,
      address: series.address,
      start,
      end,
      assignedTechIds: series.assignedTechIds,
      status: "scheduled",
      createdBy: series.createdBy,
      seriesId: series._id,
    });
  }

  if (!docs.length) return 0;

  await Job.insertMany(docs, { ordered: false }).catch((e) => {
    if (e?.writeErrors) return;
    throw e;
  });
  return docs.length;
}

export async function regenerateSeriesWindow(seriesId) {
  const series = await JobSeries.findById(seriesId);
  if (!series) return { ok: false, error: "Series not found" };

  const now = new Date();
  const from = startOfUtcDay(now);
  const until = new Date(from.getTime() + DEFAULT_WEEKS * 7 * MS_DAY);

  await Job.deleteMany({
    seriesId: series._id,
    start: { $gte: from },
  });

  await materializeSeriesInstances(series, from, until);

  series.windowGeneratedUntil = until;
  await series.save();

  return { ok: true, series };
}

export async function materializeNewSeries(series) {
  const now = new Date();
  const from = startOfUtcDay(now);
  const until = new Date(from.getTime() + DEFAULT_WEEKS * 7 * MS_DAY);
  await materializeSeriesInstances(series, from, until);
  series.windowGeneratedUntil = until;
  await series.save();
}
