export type SummaryStatus =
  | "no_previous"
  | "no_material_change"
  | "pending"
  | "ready"
  | "llm_cap_reached"
  | "llm_timeout"
  | "llm_failed"
  | "llm_unusable"
  | "poll_failed";

export type PollStatus = "ok" | "not_found" | "error" | "timeout" | "partial";

export function summaryReason(
  summaryStatus: SummaryStatus | string,
  pollStatus: PollStatus | string,
): string | null {
  if (summaryStatus === "ready") {
    return null;
  }

  switch (summaryStatus) {
    case "no_previous":
      return "No earlier listing to compare against.";
    case "no_material_change":
      return "Nothing material changed since the last baseline.";
    case "pending":
      return "A summary is being written.";
    case "llm_cap_reached":
      return "The daily LLM cap was already reached.";
    case "llm_timeout":
      return "The model call timed out.";
    case "llm_failed":
      return "The model call failed.";
    case "llm_unusable":
      return "The model response was unusable.";
    case "poll_failed":
      if (pollStatus === "not_found") {
        return "No listing was found for this competitor.";
      }
      if (pollStatus === "partial") {
        return "The listing body was incomplete.";
      }
      if (pollStatus === "timeout") {
        return "The listing request timed out.";
      }
      return "The listing poll failed.";
    default:
      return "No summary is available.";
  }
}
