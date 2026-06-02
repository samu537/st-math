import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Peer = { id: string; pc: RTCPeerConnection; stream: MediaStream };
type VoiceRoomProps = {
  roomId: string;
  userId: string;
  nickname: string;
  autoJoin?: boolean;
  onLeave?: () => void;
};

const ICE: RTCConfiguration = {
  iceServers: [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }],
};

export function VoiceRoom({ roomId, userId, nickname, autoJoin = false, onLeave }: VoiceRoomProps) {
  const [joined, setJoined] = useState(false);
  const [joining, setJoining] = useState(false);
  const [muted, setMuted] = useState(false);
  const [peers, setPeers] = useState<{ id: string; nickname: string; speaking: boolean }[]>([]);
  const [err, setErr] = useState("");
  const peersRef = useRef<Map<string, Peer>>(new Map());
  const pendingIceRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const audioContainer = useRef<HTMLDivElement>(null);
  const selfTokenRef = useRef(`${userId}-${Math.random().toString(36).slice(2, 8)}`);

  const cleanup = () => {
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    peersRef.current.forEach((p) => p.pc.close());
    peersRef.current.clear();
    pendingIceRef.current.clear();
    if (channelRef.current) supabase.removeChannel(channelRef.current);
    channelRef.current = null;
    audioContainer.current?.replaceChildren();
    setPeers([]);
    setJoined(false);
    setJoining(false);
  };

  useEffect(() => () => cleanup(), []);

  const addPeerAudio = (peerToken: string, stream: MediaStream) => {
    if (!audioContainer.current) return;
    const existing = audioContainer.current.querySelector(
      `[data-peer="${peerToken}"]`,
    ) as HTMLAudioElement | null;
    if (existing) {
      existing.srcObject = stream;
      return;
    }
    const el = document.createElement("audio");
    el.autoplay = true;
    el.dataset.peer = peerToken;
    el.srcObject = stream;
    audioContainer.current.appendChild(el);
    void el
      .play()
      .catch(() => setErr("Tap Join voice again if your browser blocked audio playback."));
  };

  const addIce = async (peerToken: string, candidate: RTCIceCandidateInit) => {
    const peer = peersRef.current.get(peerToken);
    if (!peer) return;
    if (!peer.pc.remoteDescription) {
      pendingIceRef.current.set(peerToken, [
        ...(pendingIceRef.current.get(peerToken) ?? []),
        candidate,
      ]);
      return;
    }
    await peer.pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
  };

  const flushIce = async (peerToken: string) => {
    const queued = pendingIceRef.current.get(peerToken) ?? [];
    pendingIceRef.current.delete(peerToken);
    for (const candidate of queued) await addIce(peerToken, candidate);
  };

  const makePeer = (peerToken: string, peerNick: string, initiator: boolean): Peer => {
    const pc = new RTCPeerConnection(ICE);
    const stream = new MediaStream();
    localStreamRef.current?.getTracks().forEach((t) => pc.addTrack(t, localStreamRef.current!));
    pc.ontrack = (e) => {
      e.streams[0].getTracks().forEach((tr) => stream.addTrack(tr));
      addPeerAudio(peerToken, stream);
    };
    pc.onicecandidate = (e) => {
      if (e.candidate)
        channelRef.current?.send({
          type: "broadcast",
          event: "ice",
          payload: { from: selfTokenRef.current, to: peerToken, candidate: e.candidate },
        });
    };
    const peer: Peer = { id: peerToken, pc, stream };
    peersRef.current.set(peerToken, peer);
    setPeers((prev) =>
      prev.find((p) => p.id === peerToken)
        ? prev
        : [...prev, { id: peerToken, nickname: peerNick, speaking: false }],
    );

    if (initiator) {
      pc.createOffer()
        .then((o) => pc.setLocalDescription(o))
        .then(() =>
          channelRef.current?.send({
            type: "broadcast",
            event: "offer",
            payload: {
              from: selfTokenRef.current,
              fromNick: nickname,
              to: peerToken,
              sdp: pc.localDescription,
            },
          }),
        )
        .catch((e) => setErr(e instanceof Error ? e.message : "Could not start the call."));
    }
    return peer;
  };

  const removePeer = (peerToken: string) => {
    const p = peersRef.current.get(peerToken);
    if (p) {
      p.pc.close();
      peersRef.current.delete(peerToken);
    }
    pendingIceRef.current.delete(peerToken);
    audioContainer.current?.querySelector(`[data-peer="${peerToken}"]`)?.remove();
    setPeers((prev) => prev.filter((x) => x.id !== peerToken));
  };

  const leave = () => {
    cleanup();
    onLeave?.();
  };

  const join = async () => {
    if (joined || joining) return;
    setErr("");
    setJoining(true);
    try {
      if (!navigator.mediaDevices?.getUserMedia)
        throw new Error("Voice chat needs microphone access in a secure browser tab.");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;
      const channel = supabase.channel(`voice-${roomId}`, {
        config: { presence: { key: selfTokenRef.current } },
      });
      channelRef.current = channel;

      channel.on("broadcast", { event: "offer" }, async ({ payload }) => {
        if (payload.to !== selfTokenRef.current) return;
        let peer = peersRef.current.get(payload.from);
        if (!peer) peer = makePeer(payload.from, payload.fromNick ?? "peer", false);
        try {
          await peer.pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
          await flushIce(payload.from);
          const answer = await peer.pc.createAnswer();
          await peer.pc.setLocalDescription(answer);
          await channel.send({
            type: "broadcast",
            event: "answer",
            payload: {
              from: selfTokenRef.current,
              to: payload.from,
              sdp: peer.pc.localDescription,
            },
          });
        } catch (e) {
          setErr(e instanceof Error ? e.message : "Could not answer the call.");
        }
      });
      channel.on("broadcast", { event: "answer" }, async ({ payload }) => {
        if (payload.to !== selfTokenRef.current) return;
        const peer = peersRef.current.get(payload.from);
        if (!peer || peer.pc.signalingState === "stable") return;
        await peer.pc.setRemoteDescription(new RTCSessionDescription(payload.sdp)).catch(() => {});
        await flushIce(payload.from);
      });
      channel.on("broadcast", { event: "ice" }, ({ payload }) => {
        if (payload.to !== selfTokenRef.current) return;
        void addIce(payload.from, payload.candidate);
      });
      channel.on("presence", { event: "sync" }, () => {
        const state = channel.presenceState() as Record<string, { nickname: string }[]>;
        const tokens = Object.keys(state).filter((t) => t !== selfTokenRef.current);
        // Connect to new peers (only if our token is lexicographically smaller, to avoid duplicate offers)
        tokens.forEach((t) => {
          if (!peersRef.current.has(t) && selfTokenRef.current < t) {
            makePeer(t, state[t][0]?.nickname ?? "peer", true);
          }
        });
        // Remove peers no longer present
        peersRef.current.forEach((_, id) => {
          if (!tokens.includes(id)) removePeer(id);
        });
      });

      await channel.subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ nickname });
          setJoined(true);
          setJoining(false);
        }
      });
    } catch (e) {
      setJoining(false);
      setErr(e instanceof Error ? e.message : "Mic access denied");
    }
  };

  useEffect(() => {
    if (autoJoin && !joined && !joining) void join();
  }, [autoJoin, joined, joining, join]);

  const toggleMute = () => {
    const tracks = localStreamRef.current?.getAudioTracks() ?? [];
    tracks.forEach((t) => (t.enabled = muted));
    setMuted(!muted);
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-xs font-black uppercase tracking-widest text-muted-foreground">
            🎙 Voice room
          </div>
          <div className="mt-0.5 text-sm font-bold">
            {joined ? `Connected — ${peers.length + 1} in call` : "Not connected"}
          </div>
        </div>
        {!joined ? (
          <button
            onClick={join}
            disabled={joining}
            className="rounded-md bg-gradient-to-br from-primary to-ember px-4 py-2 text-sm font-bold text-primary-foreground hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {joining ? "Joining…" : "Join voice"}
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={toggleMute}
              className={`rounded-md border px-3 py-2 text-sm font-bold ${muted ? "border-destructive text-destructive" : "border-border text-foreground"}`}
            >
              {muted ? "🔇 Muted" : "🎤 Live"}
            </button>
            <button
              onClick={leave}
              className="rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-sm font-bold text-destructive hover:bg-destructive hover:text-destructive-foreground"
            >
              Leave
            </button>
          </div>
        )}
      </div>
      {err && <p className="mt-2 text-sm text-destructive">{err}</p>}
      {joined && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Chip nickname={nickname + " (you)"} />
          {peers.map((p) => (
            <Chip key={p.id} nickname={p.nickname} />
          ))}
        </div>
      )}
      <div ref={audioContainer} className="hidden" />
    </div>
  );
}

function Chip({ nickname }: { nickname: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />
      {nickname}
    </span>
  );
}
