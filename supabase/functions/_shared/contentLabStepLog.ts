// Shared helper for writing per-step Content Lab pipeline logs.
// Each step records a "started" row and an "ok" or "failed" finish row.
// Failures here must NEVER throw — observability must not break the pipeline.

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

export type StepName = "discover" | "scrape" | "analyse" | "ideate" | "pipeline";
export type StepStatus = "started" | "ok" | "failed";

let cachedAdmin: SupabaseClient | null = null;

function admin(): SupabaseClient {
  if (cachedAdmin) return cachedAdmin;
  cachedAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  return cachedAdmin;
}

export interface StepLogStartArgs {
  runId: string;
  step: StepName;
  message?: string;
  payload?: Record<string, unknown>;
}

export interface StepLogFinishArgs {
  status: "ok" | "failed";
  message?: string;
  payload?: Record<string, unknown>;
  errorMessage?: string;
}

export interface StepLogHandle {
  finish(args: StepLogFinishArgs): Promise<void>;
}

export async function logStepStart(args: StepLogStartArgs): Promise<StepLogHandle> {
  const startedAt = new Date();
  let logId: string | null = null;

  try {
    const { data } = await admin()
      .from("content_lab_step_logs")
      .insert({
        run_id: args.runId,
        step: args.step,
        status: "started",
        started_at: startedAt.toISOString(),
        message: args.message ?? null,
        payload: args.payload ?? {},
      })
      .select("id")
      .single();
    logId = data?.id ?? null;
  } catch (e) {
    console.error("logStepStart failed (non-fatal):", e);
  }

  return {
    async finish(finishArgs) {
      const completedAt = new Date();
      const durationMs = completedAt.getTime() - startedAt.getTime();
      try {
        if (logId) {
          await admin()
            .from("content_lab_step_logs")
            .update({
              status: finishArgs.status,
              completed_at: completedAt.toISOString(),
              duration_ms: durationMs,
              message: finishArgs.message ?? null,
              payload: finishArgs.payload ?? {},
              error_message: finishArgs.errorMessage ?? null,
            })
            .eq("id", logId);
        } else {
          // Fallback: insert a finish row even if start row failed
          await admin().from("content_lab_step_logs").insert({
            run_id: args.runId,
            step: args.step,
            status: finishArgs.status,
            started_at: startedAt.toISOString(),
            completed_at: completedAt.toISOString(),
            duration_ms: durationMs,
            message: finishArgs.message ?? null,
            payload: finishArgs.payload ?? {},
            error_message: finishArgs.errorMessage ?? null,
          });
        }
      } catch (e) {
        console.error("logStep finish failed (non-fatal):", e);
      }
    },
  };
}
