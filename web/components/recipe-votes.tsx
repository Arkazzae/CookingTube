"use client";
import { useEffect, useState } from "react";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { voterId } from "@/lib/browser-identity";
import type { AppLocale } from "@/lib/locale";
import "./recipe-features.css";
import { useAppLocale } from "@/hooks/use-app-locale";

export function RecipeVotes({ id, language }: { id: string; language?: AppLocale }) {
  const uiLocale = useAppLocale();
  const locale = language ?? uiLocale;
  const copy = voteCopy[uiLocale];
  const [score, setScore] = useState<number | null>(null);
  const [mine, setMine] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(`/api/library?id=${id}&lang=${locale}`, { headers: { "x-voter-id": voterId() }, signal: controller.signal });
        const data = await response.json() as { error?: string; score: number; myVote: number };
        if (!response.ok) throw new Error(data.error || copy.unavailable);
        if (typeof data.score !== "number" || ![-1, 0, 1].includes(data.myVote)) throw new Error(copy.readError);
        setScore(data.score); setMine(data.myVote);
      } catch (error) { if (!controller.signal.aborted) setMessage(error instanceof Error && navigator.onLine ? error.message : copy.offline); }
    }
    void load(); return () => controller.abort();
  }, [id, locale, copy]);
  async function vote(value: number) {
    if (busy) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/vote?lang=${locale}`, { method: "POST", headers: { "Content-Type": "application/json", "x-voter-id": voterId() }, body: JSON.stringify({ id, value: mine === value ? 0 : value }) });
      const data = await response.json() as { error?: string; score: number; myVote: number };
      if (!response.ok) throw new Error(data.error || copy.saveError);
      if (!Number.isFinite(data.score) || ![-1, 0, 1].includes(data.myVote)) throw new Error(copy.readError);
      setMine(data.myVote); setScore(data.score); setMessage(data.myVote ? copy.saved : copy.removed);
    } catch (error) { setMessage(error instanceof Error && navigator.onLine ? error.message : copy.offline); }
    finally { setBusy(false); }
  }
  return <section className="recipe-votes" aria-label={copy.label}>
    <div><strong>{copy.question}</strong><p>{copy.hint}</p></div>
    <div className="vote-actions"><button disabled={busy || score === null} aria-pressed={mine === 1} onClick={() => void vote(1)}><ThumbsUp size={18} /> {copy.yes}</button><span aria-label={copy.balance}>{score ?? "—"}</span><button disabled={busy || score === null} aria-pressed={mine === -1} onClick={() => void vote(-1)}><ThumbsDown size={18} /> {copy.no}</button></div>
    {message && <p className="vote-message" role="status">{message}</p>}
  </section>;
}

const voteCopy = {
  pl: { label: "Ocena przepisu", question: "Przepis zgadza się z filmem?", hint: "Jeden głos z tej przeglądarki. Możesz zmienić zdanie.", yes: "Tak", no: "Nie", balance: "Bilans głosów", unavailable: "Głosowanie jest chwilowo niedostępne.", readError: "Nie udało się odczytać głosów.", saveError: "Nie udało się zapisać głosu.", offline: "Połącz się z internetem i spróbuj ponownie zagłosować.", saved: "Głos zapisany. Możesz go zmienić lub cofnąć.", removed: "Głos cofnięty." },
  en: { label: "Rate this recipe", question: "Does this recipe match the video?", hint: "One vote per browser. You can change your mind.", yes: "Yes", no: "No", balance: "Vote balance", unavailable: "Voting is temporarily unavailable.", readError: "We could not read the votes.", saveError: "We could not save your vote.", offline: "Connect to the internet and try voting again.", saved: "Vote saved. You can change or undo it.", removed: "Vote removed." },
};
