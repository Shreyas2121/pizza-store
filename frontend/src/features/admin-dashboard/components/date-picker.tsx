import { Button, Select } from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import "@mantine/dates/styles.css";
import { useState } from "react";
import dayjs from "dayjs";
import { CalendarRange } from "lucide-react";
import { useDatePicker } from "../model/dashboard-date.store";

import { GroupT } from "../model/dashboard.types";
import { useAuthModalStore } from "@/shared/model";

const presets = [
  { label: "Today", value: "today" },
  { label: "Last 7 Days", value: "last7" },
  { label: "Last 30 Days", value: "last30" },
  { label: "Last 3 Months", value: "last3m" },
];

const groupOptions = [
  { label: "Daily", value: "daily" },
  { label: "Monthly", value: "monthly" },
  { label: "Quarterly", value: "quarterly" },
  { label: "Yearly", value: "yearly" },
];

export const DatePicker = () => {
  const { dates, setDates, group, setGroup } = useDatePicker();
  const { closeModal } = useAuthModalStore();

  const [localDates, setLocalDates] =
    useState<[Date | null, Date | null]>(dates);
  const [localGroup, setLocalGroup] = useState<GroupT>(group);

  const handlePresetClick = (presetValue: string) => {
    const today = new Date();
    let newDates: [Date | null, Date | null] = [null, null];

    switch (presetValue) {
      case "today":
        newDates = [today, today];
        break;
      case "last7":
        newDates = [dayjs(today).subtract(6, "day").toDate(), today];
        break;
      case "last30":
        newDates = [dayjs(today).subtract(29, "day").toDate(), today];
        break;
      case "last3m":
        newDates = [dayjs(today).subtract(90, "day").toDate(), today];
        break;
      default:
        newDates = [today, today];
        break;
    }
    setLocalDates(newDates);
  };

  const isSubmitDisabled = !localDates[0] || !localDates[1];

  const handleSubmit = () => {
    setDates(localDates);
    setGroup(localGroup);
    closeModal();
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <span className="grid h-11 w-11 place-items-center rounded-full bg-brand-soft text-brand">
          <CalendarRange size={22} aria-hidden="true" />
        </span>
        <h2 className="mt-4 text-page-title-scale">Dashboard date range</h2>
        <p className="mt-2 text-supporting-scale">
          Choose the reporting period and how results should be grouped.
        </p>
      </div>
      <DatePickerInput
        type="range"
        value={localDates}
        onChange={setLocalDates}
        label="Date range"
        withAsterisk
        placeholder="Pick a date range"
        clearable
      />

      <div>
        <p className="mb-2 text-sm font-medium text-ink">Quick ranges</p>
        <div className="flex flex-wrap gap-2">
          {presets.map((preset) => (
            <Button
              key={preset.value}
              variant="outline"
              size="sm"
              onClick={() => handlePresetClick(preset.value)}
            >
              {preset.label}
            </Button>
          ))}
        </div>
      </div>

      <Select
        label="Group results by"
        value={localGroup}
        onChange={(val) => setLocalGroup(val as GroupT)}
        data={groupOptions}
      />

      <Button size="md" disabled={isSubmitDisabled} onClick={handleSubmit}>
        Apply date range
      </Button>
    </div>
  );
};

export default DatePicker;
