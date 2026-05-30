import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Heart, Loader2, CheckCircle2, Clock } from "lucide-react";

type Status = "idle" | "submitting" | "pending" | "completed" | "failed";

const MIN_AMOUNT = 500;
const PAYMENT_SESSION_KEY = "donate_easy_pending_payment";
const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 5 * 60 * 1000;

function normalizePhoneClient(raw: string): string | null {
  const d = raw.replace(/\D/g, "");
  if (/^0[67]\d{8}$/.test(d)) return "255" + d.slice(1);
  if (/^255[67]\d{8}$/.test(d)) return d;
  return null;
}

type SavedPaymentSession = {
  donationId: string;
  fullName: string;
  email: string;
  phone: string;
  amount: string;
  startedAt: number;
};

const Index = () => {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState<string>("");
  const [status, setStatus] = useState<Status>("idle");
  const [donationId, setDonationId] = useState<string | null>(null);
  const [pendingMessage, setPendingMessage] = useState("Angalia simu yako kuingiza PIN ya M-Pesa/Tigo/Airtel.");

  const pollerRef = useRef<number | null>(null);
  const pollStartedAtRef = useRef<number>(0);
  const pollingBusyRef = useRef(false);

  const presets = [1000, 5000, 10000, 50000];

  const savePendingSession = (session: SavedPaymentSession) => {
    localStorage.setItem(PAYMENT_SESSION_KEY, JSON.stringify(session));
  };

  const clearPendingSession = () => {
    localStorage.removeItem(PAYMENT_SESSION_KEY);
  };

  const stopPolling = () => {
    if (pollerRef.current !== null) {
      window.clearInterval(pollerRef.current);
      pollerRef.current = null;
    }
    pollingBusyRef.current = false;
  };

  const checkDonationStatus = async (id: string, startedAt: number) => {
    if (pollingBusyRef.current) return;
    pollingBusyRef.current = true;

    try {
      const { data: row, error } = await supabase
        .from("donations")
        .select("status,gateway_ref,updated_at")
        .eq("id", id)
        .maybeSingle();

      if (error) throw error;

      const paymentStatus = String(row?.status ?? "").toUpperCase();

      if (paymentStatus === "COMPLETED") {
        stopPolling();
        clearPendingSession();
        setPendingMessage("Tumepokea malipo yako kwa mafanikio.");
        setStatus("completed");
        toast({ title: "Malipo yamekamilika", description: "Asante sana." });
        return;
      }

      if (paymentStatus && paymentStatus !== "PENDING") {
        stopPolling();
        clearPendingSession();
        setStatus("failed");
        toast({
          title: "Malipo hayajakamilika",
          description: "Tafadhali jaribu tena au thibitisha kwa mtoa huduma.",
          variant: "destructive",
        });
        return;
      }

      const elapsed = Date.now() - startedAt;
      if (elapsed >= POLL_TIMEOUT_MS) {
        setPendingMessage(
          "Kama tayari umeingiza PIN na umepokea SMS ya muamala, subiri kidogo kisha bonyeza Angalia tena. Uthibitisho unaweza kuchelewa."
        );
        stopPolling();
        return;
      }

      if (elapsed > 60000) {
        setPendingMessage(
          "Malipo bado yanathibitishwa. Kawaida hili hutokea callback ikichelewa kwa muda mfupi."
        );
      }
    } catch (error) {
      console.error("Failed to check donation status", error);
      setPendingMessage("Imeshindikana kuangalia uthibitisho wa malipo. Bonyeza Angalia tena.");
      stopPolling();
    } finally {
      pollingBusyRef.current = false;
    }
  };

  const startPolling = (id: string, startedAt = Date.now()) => {
    stopPolling();
    pollStartedAtRef.current = startedAt;
    setDonationId(id);
    setStatus("pending");
    void checkDonationStatus(id, startedAt);
    pollerRef.current = window.setInterval(() => {
      void checkDonationStatus(id, startedAt);
    }, POLL_INTERVAL_MS);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (fullName.trim().length < 2) return toast({ title: "Tafadhali andika jina kamili", variant: "destructive" });
    if (!/^\S+@\S+\.\S+$/.test(email)) return toast({ title: "Email si sahihi", variant: "destructive" });
    if (!normalizePhoneClient(phone)) return toast({ title: "Namba ya simu si sahihi", description: "Tumia muundo 07XXXXXXXX", variant: "destructive" });
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt < MIN_AMOUNT) return toast({ title: `Kiwango cha chini ni TZS ${MIN_AMOUNT.toLocaleString()}`, variant: "destructive" });

    setStatus("submitting");
    setPendingMessage("Angalia simu yako kuingiza PIN ya M-Pesa/Tigo/Airtel.");

    const { data, error } = await supabase.functions.invoke("donate", {
      body: { full_name: fullName, email, phone, amount: amt },
    });

    if (error || !data?.ok) {
      setStatus("idle");
      return toast({ title: "Imeshindikana", description: data?.error || error?.message || "Jaribu tena", variant: "destructive" });
    }

    const newDonationId = String(data.donation_id || "");
    const startedAt = Date.now();

    savePendingSession({
      donationId: newDonationId,
      fullName,
      email,
      phone,
      amount,
      startedAt,
    });

    toast({ title: "Ombi limetumwa", description: "Angalia simu yako kwa USSD prompt." });
    startPolling(newDonationId, startedAt);
  };

  const reset = () => {
    stopPolling();
    clearPendingSession();
    setStatus("idle");
    setDonationId(null);
    setPendingMessage("Angalia simu yako kuingiza PIN ya M-Pesa/Tigo/Airtel.");
    setFullName("");
    setEmail("");
    setPhone("");
    setAmount("");
  };

  const retryStatusCheck = () => {
    if (!donationId) return;
    const startedAt = pollStartedAtRef.current || Date.now();
    setPendingMessage("Inaangalia uthibitisho wa malipo tena...");
    startPolling(donationId, startedAt);
  };

  useEffect(() => {
    const raw = localStorage.getItem(PAYMENT_SESSION_KEY);
    if (!raw) return;

    try {
      const saved = JSON.parse(raw) as SavedPaymentSession;
      if (!saved?.donationId) {
        clearPendingSession();
        return;
      }

      setFullName(saved.fullName || "");
      setEmail(saved.email || "");
      setPhone(saved.phone || "");
      setAmount(saved.amount || "");
      setPendingMessage("Tunarejesha uthibitisho wa malipo uliokuwa unaendelea...");
      startPolling(saved.donationId, Number(saved.startedAt) || Date.now());
    } catch {
      clearPendingSession();
    }

    return () => {
      stopPolling();
    };
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="relative overflow-hidden" style={{ background: "var(--gradient-hero)" }}>
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 20% 50%, white 1px, transparent 1px)", backgroundSize: "30px 30px" }} />
        <div className="relative max-w-3xl mx-auto px-6 pt-12 pb-20 text-primary-foreground">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur text-sm mb-6">
            <Heart className="w-4 h-4" /> Changia leo
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold leading-tight mb-3">
            Mchango wako unabadilisha maisha.
          </h1>
          <p className="text-lg opacity-90 max-w-xl">
            Tumia M-Pesa, Tigo Pesa au Airtel Money kuchangia kwa usalama. Kila shilingi inahesabika.
          </p>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 -mt-12 pb-16">
        <Card className="p-6 sm:p-8 shadow-2xl border-0" style={{ boxShadow: "var(--shadow-elegant)" }}>
          {status === "completed" ? (
            <div className="text-center py-8">
              <CheckCircle2 className="w-16 h-16 mx-auto text-primary mb-4" />
              <h2 className="text-2xl font-bold mb-2">Asante sana!</h2>
              <p className="text-muted-foreground mb-6">Mchango wako umepokelewa kwa mafanikio.</p>
              <Button onClick={reset}>Changia tena</Button>
            </div>
          ) : status === "pending" ? (
            <div className="text-center py-8">
              <Clock className="w-16 h-16 mx-auto text-primary mb-4 animate-pulse" />
              <h2 className="text-2xl font-bold mb-2">Inasubiri uthibitisho</h2>
              <p className="text-muted-foreground mb-2">{pendingMessage}</p>
              <p className="text-xs text-muted-foreground mb-6">Donation ID: {donationId?.slice(0, 8)}...</p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button variant="outline" onClick={retryStatusCheck}>Angalia tena</Button>
                <Button variant="outline" onClick={reset}>Anza upya</Button>
              </div>
            </div>
          ) : status === "failed" ? (
            <div className="text-center py-8">
              <Clock className="w-16 h-16 mx-auto text-destructive mb-4" />
              <h2 className="text-2xl font-bold mb-2">Malipo hayajathibitishwa</h2>
              <p className="text-muted-foreground mb-6">
                Kama tayari umeingiza PIN na umepokea SMS ya muamala, bonyeza Angalia tena kabla ya kuanzisha malipo mapya.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button onClick={retryStatusCheck} disabled={!donationId}>Angalia tena</Button>
                <Button variant="outline" onClick={reset}>Anza upya</Button>
              </div>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-5">
              <div>
                <h2 className="text-2xl font-bold mb-1">Maelezo ya mchango</h2>
                <p className="text-sm text-muted-foreground">Sehemu zote zinahitajika.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Jina kamili</Label>
                <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Mfano: Asha Mwakyusa" />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jina@mfano.com" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Simu</Label>
                  <Input id="phone" inputMode="numeric" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07XXXXXXXX" />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="amount">Kiasi (TZS)</Label>
                <Input id="amount" type="number" min={MIN_AMOUNT} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={`Chini ya ${MIN_AMOUNT.toLocaleString()}`} />
                <div className="flex flex-wrap gap-2 pt-1">
                  {presets.map((p) => (
                    <button
                      type="button"
                      key={p}
                      onClick={() => setAmount(String(p))}
                      className="px-3 py-1.5 rounded-full text-sm border border-border hover:bg-primary hover:text-primary-foreground transition"
                    >
                      TZS {p.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>

              <Button type="submit" className="w-full h-12 text-base" disabled={status === "submitting"}>
                {status === "submitting" ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Inatuma...</>
                ) : (
                  <><Heart className="w-4 h-4 mr-2" /> Changia sasa</>
                )}
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                Kwa kubonyeza Changia, unakubali masharti ya huduma.
              </p>
            </form>
          )}
        </Card>
      </main>
    </div>
  );
};

export default Index;
