import axios from "axios";

export const apiMessage = (cause: unknown) => axios.isAxiosError<{ message?: string }>(cause)
  ? cause.response?.data?.message ?? "The request could not be completed."
  : "The request could not be completed.";

export const humanizeStatus = (value: string) => value.replace(/_/g, " ");

export const financeStatusColor = (status: string) => {
  if (["processed", "matched", "reconciled", "resolved", "closed", "approved", "paid", "posted", "costs complete"].includes(status)) return "green";
  if (["failed", "mismatch", "critical", "rejected", "voided", "reversed"].includes(status)) return "red";
  if (["requested", "needs_review", "warning", "submitted", "cost gaps"].includes(status)) return "yellow";
  return "gray";
};
