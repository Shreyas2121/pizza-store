import { useDatePicker } from "@/store/datepicker";
import { Button, Select } from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import "@mantine/dates/styles.css";
import { useState } from "react";
import { subDays } from "date-fns";
import { GroupT } from "@/lib/types";

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

const DatePicker = () => {
  const { dates, setDates, group, setGroup } = useDatePicker();

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
        newDates = [subDays(today, 6), today];
        break;
      case "last30":
        newDates = [subDays(today, 29), today];
        break;
      case "last3m":
        newDates = [subDays(today, 90), today];
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
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      <DatePickerInput
        type="range"
        value={localDates}
        onChange={setLocalDates}
        label="Select Date Range"
        placeholder="Pick a date range"
        clearable
      />

      {/* Preset Buttons */}
      <div className="flex flex-wrap gap-2">
        {presets.map((preset) => (
          <Button
            key={preset.value}
            variant="outline"
            onClick={() => handlePresetClick(preset.value)}
          >
            {preset.label}
          </Button>
        ))}
      </div>

      {/* Group By Select */}
      <Select
        label="Group By"
        value={localGroup}
        onChange={(val) => setLocalGroup(val as GroupT)}
        data={groupOptions}
      />

      <Button disabled={isSubmitDisabled} onClick={handleSubmit}>
        Submit
      </Button>
    </div>
  );
};

export default DatePicker;
