const istTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Kolkata",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const toMinutes = (time: string) => {
  const [hours, minutes] = time.split(":").map(Number);
  return Number.isInteger(hours) && Number.isInteger(minutes) ? hours * 60 + minutes : null;
};

export const isStoreOpen = (opensAt: string, closesAt: string, date = new Date()) => {
  const opens = toMinutes(opensAt);
  const closes = toMinutes(closesAt);
  if (opens === null || closes === null) return false;
  if (opens === closes) return true;

  const parts = istTimeFormatter.formatToParts(date);
  const hours = Number(parts.find((part) => part.type === "hour")?.value);
  const minutes = Number(parts.find((part) => part.type === "minute")?.value);
  const current = hours * 60 + minutes;
  return opens < closes ? current >= opens && current < closes : current >= opens || current < closes;
};

