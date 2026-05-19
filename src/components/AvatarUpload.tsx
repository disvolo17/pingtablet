import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Camera } from "lucide-react";
import { toast } from "sonner";
import { setCurrentPlayer, getCurrentPlayer } from "@/lib/currentPlayer";

export default function AvatarUpload({
  playerId,
  handle,
  onChanged,
}: {
  playerId: string;
  handle: string;
  onChanged: (url: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const onPick = () => fileRef.current?.click();

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (f.size > 4 * 1024 * 1024) {
      toast.error("Файл больше 4 МБ");
      return;
    }
    setBusy(true);
    try {
      const ext = (f.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${handle}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, f, {
        cacheControl: "3600",
        upsert: false,
        contentType: f.type || undefined,
      });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      const url = data.publicUrl;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).rpc("set_player_avatar", {
        _player_id: playerId,
        _avatar_url: url,
      });
      if (error) throw error;

      onChanged(url);
      const me = getCurrentPlayer();
      if (me?.id === playerId) setCurrentPlayer({ ...me, avatar_url: url });
      toast.success("Фото обновлено");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось загрузить");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" />
      <Button
        size="sm"
        variant="outline"
        onClick={onPick}
        disabled={busy}
        className="rounded-full"
        aria-label="Сменить фото"
      >
        <Camera className="h-4 w-4 mr-1.5" /> {busy ? "…" : "Фото"}
      </Button>
    </>
  );
}
