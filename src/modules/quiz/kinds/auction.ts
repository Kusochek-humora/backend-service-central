import { z } from "zod";
import { KindError, QuestionKind, baseSettings, parsePayload, symmetricPoints } from "./types";

export const auctionSettings = z.object({
  ...baseSettings,
  startBid: z.number().int().positive(),
  step: z.number().int().positive(),
});

interface Bid {
  participantId: string;
  amount: number;
}

const maxBid = (bids: Bid[]) => bids.reduce<Bid | null>((m, b) => (!m || b.amount > m.amount ? b : m), null);

/**
 * Аукцион: таблица ставок (place_bid), close_bidding фиксирует победителя. Цена вопроса = его ставка,
 * победитель становится активным игроком. Дальше begin_play.
 */
export const auctionKind: QuestionKind = {
  kind: "auction",
  settingsSchema: auctionSettings,
  initState: () => ({ phase: "prepare", bids: [], closed: false, winnerId: null, winningBid: null }),
  commands: {
    place_bid(state, payload, ctx, q) {
      const { participantId, amount } = parsePayload(z.object({ participantId: z.uuid(), amount: z.number().int() }), payload);
      const s = auctionSettings.parse(q.settings);
      if (state.closed) throw new KindError("INVALID_TRANSITION", "Торги уже закрыты");
      if (!ctx.players.some((p) => p.id === participantId)) throw new KindError("VALIDATION_ERROR", "Этого игрока нет в сессии");
      const top = maxBid(state.bids);
      const min = top ? top.amount + s.step : s.startBid;
      if (amount < min) throw new KindError("VALIDATION_ERROR", `Минимальная ставка: ${min}`, { minBid: min });
      return { ...state, bids: [...state.bids, { participantId, amount }] };
    },
    close_bidding(state) {
      if (state.closed) throw new KindError("INVALID_TRANSITION", "Торги уже закрыты");
      const top = maxBid(state.bids);
      if (!top) throw new KindError("VALIDATION_ERROR", "Не было ни одной ставки");
      return { ...state, closed: true, winnerId: top.participantId, winningBid: top.amount };
    },
  },
  commandRules: { place_bid: { phase: "prepare" }, close_bidding: { phase: "prepare" } },
  activeParticipant: (_q, state) => state.winnerId,
  canBeginPlay: (_q, state) => (state.closed ? null : "Сначала закройте торги (close_bidding)"),
  project(q, state) {
    const s = auctionSettings.parse(q.settings);
    const top = maxBid(state.bids);
    return {
      startBid: s.startBid,
      step: s.step,
      bids: state.bids,
      closed: state.closed,
      winnerId: state.winnerId,
      winningBid: state.winningBid,
      minNextBid: state.closed ? null : top ? top.amount + s.step : s.startBid,
    };
  },
  points: (q, state) => symmetricPoints(q, state.winningBid ?? q.price),
};
