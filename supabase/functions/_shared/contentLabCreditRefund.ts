// Centralised credit-refund with one retry + audit breadcrumb.
// Used by content-lab-regenerate-idea, content-lab-remix-idea (and any future
// flows that spend credits before calling an LLM and need to make the user whole
// on failure). If both attempts fail the failure is written to step_logs as a
// 'refund_failed' entry tagged with the ledger id so admins can reconcile.

// deno-lint-ignore no-explicit-any
type AdminClient = any;

interface Args {
  admin: AdminClient;
  ledgerId: string;
  refundReason: string;
  /** Optional run id so the breadcrumb is queryable per-run in the admin UI. */
  runId?: string | null;
  /** Caller name for logs ("content-lab-regenerate-idea"). */
  caller: string;
}

export async function refundCreditWithRetry({
  admin, ledgerId, refundReason, runId, caller,
}: Args): Promise<{ ok: boolean; error?: string }> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    const { error } = await admin.rpc("refund_content_lab_credit", {
      _ledger_id: ledgerId,
      _refund_reason: refundReason,
    });
    if (!error) return { ok: true };
    console.error(`[${caller}] refund attempt ${attempt} failed:`, error);
    if (attempt === 1) await new Promise((r) => setTimeout(r, 500));
  }

  // Both attempts failed — write an auditable breadcrumb if we have a run id.
  const errMsg = `Refund failed for ledger ${ledgerId} (${refundReason})`;
  if (runId) {
    try {
      await admin.from("content_lab_step_logs").insert({
        run_id: runId,
        step: "refund_failed",
        status: "failed",
        message: errMsg,
        error_message: errMsg,
        payload: { ledger_id: ledgerId, refund_reason: refundReason, caller },
        completed_at: new Date().toISOString(),
      });
    } catch (logErr) {
      console.error(`[${caller}] could not write refund_failed step log:`, logErr);
    }
  }
  return { ok: false, error: errMsg };
}
