import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { Step1NicheBasics } from "@/components/content-lab/onboard/Step1NicheBasics";
import { Step2Handles } from "@/components/content-lab/onboard/Step2Handles";
import { Step3Industry } from "@/components/content-lab/onboard/Step3Industry";
import { Step4Admired, type AccountRef } from "@/components/content-lab/onboard/Step4Admired";
import { Step5Competitors } from "@/components/content-lab/onboard/Step5Competitors";
import { Step6Review } from "@/components/content-lab/onboard/Step6Review";
import { VoiceBuildingScreen } from "@/components/content-lab/onboard/VoiceBuildingScreen";

const TOTAL_STEPS = 6;

export default function OnboardWizardPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const clientId = params.get("clientId") ?? "";

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [createdNicheId, setCreatedNicheId] = useState<string | null>(null);

  const [nicheName, setNicheName] = useState("");
  const [website, setWebsite] = useState("");
  const [instagram, setInstagram] = useState("");
  const [tiktok, setTiktok] = useState("");
  const [facebook, setFacebook] = useState("");
  const [industrySlug, setIndustrySlug] = useState("");
  const [admired, setAdmired] = useState<AccountRef[]>([]);
  const [competitors, setCompetitors] = useState<AccountRef[]>([]);

  const canNext = useMemo(() => {
    switch (step) {
      case 1: return nicheName.trim().length > 1;
      case 2: return instagram.trim().length > 0;
      case 3: return industrySlug.length > 0;
      case 4: return admired.length > 0;
      case 5: return true;
      case 6: return true;
      default: return false;
    }
  }, [step, nicheName, instagram, industrySlug, admired]);

  const submit = async () => {
    if (!clientId) {
      toast.error("Missing client. Open this wizard from a client page.");
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke<{ niche_id: string }>(
        "content-lab-onboard",
        {
          body: {
            client_id: clientId,
            niche_name: nicheName.trim(),
            website: website.trim() || undefined,
            instagram_handle: instagram.trim(),
            tiktok_handle: tiktok.trim() || undefined,
            facebook_handle: facebook.trim() || undefined,
            industry_slug: industrySlug && industrySlug !== "__not_listed__" ? industrySlug : undefined,
            admired_accounts: admired,
            competitors,
          },
        },
      );
      if (error || !data?.niche_id) throw new Error(error?.message ?? "Failed");
      setCreatedNicheId(data.niche_id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (createdNicheId) {
    return (
      <AppLayout>
        <div className="mx-auto max-w-2xl px-4 py-8">
          <VoiceBuildingScreen
            nicheId={createdNicheId}
            onReady={() => navigate(`/content-lab/niche/${createdNicheId}`)}
          />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="mb-8 space-y-2">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Step {step} of {TOTAL_STEPS}
          </p>
          <Progress value={(step / TOTAL_STEPS) * 100} />
        </div>

        <div className="rounded-xl border border-border bg-card p-6 sm:p-8">
          {step === 1 && (
            <Step1NicheBasics
              nicheName={nicheName}
              website={website}
              onChange={(p) => {
                if (p.nicheName !== undefined) setNicheName(p.nicheName);
                if (p.website !== undefined) setWebsite(p.website);
              }}
            />
          )}
          {step === 2 && (
            <Step2Handles
              instagram={instagram}
              tiktok={tiktok}
              facebook={facebook}
              onChange={(p) => {
                if (p.instagram !== undefined) setInstagram(p.instagram);
                if (p.tiktok !== undefined) setTiktok(p.tiktok);
                if (p.facebook !== undefined) setFacebook(p.facebook);
              }}
            />
          )}
          {step === 3 && (
            <Step3Industry industrySlug={industrySlug} onChange={setIndustrySlug} />
          )}
          {step === 4 && <Step4Admired accounts={admired} onChange={setAdmired} />}
          {step === 5 && <Step5Competitors competitors={competitors} onChange={setCompetitors} />}
          {step === 6 && (
            <Step6Review
              data={{ nicheName, website, instagram, tiktok, facebook, industrySlug, admired, competitors }}
            />
          )}
        </div>

        <div className="mt-6 flex justify-between">
          <Button
            variant="ghost"
            onClick={() => (step === 1 ? navigate("/content-lab") : setStep(step - 1))}
            disabled={submitting}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            {step === 1 ? "Cancel" : "Back"}
          </Button>
          {step < TOTAL_STEPS ? (
            <Button onClick={() => setStep(step + 1)} disabled={!canNext}>
              Next <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={submit} disabled={submitting || !canNext}>
              {submitting ? "Submitting…" : "Submit"}
            </Button>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
