import Deliberation from "./Deliberation";

/**
 * AI Boardroom — Decision OS entry that reuses the deterministic
 * Deliberation surface. Decision context (selected decision id) is
 * encoded in the URL via ?decision=<id>.
 */
export default function AIBoardroom() {
  return <Deliberation variant="boardroom" />;
}
