import json
import hashlib
import os
from datetime import datetime, timezone
from logger import get_logger

logger = get_logger(__name__)


class AuditLog:
    """
    Append-only, hash-chained audit log stored as a JSON file.

    Each entry:
        {
            "seq":       <int>,
            "timestamp": <ISO-8601>,
            "event":     <str>,
            "data":      <dict>,
            "prev_hash": <sha256 hex of previous entry>,
            "hash":      <sha256 hex of this entry>
        }

    Tampering with any entry breaks the chain — detectable via verify_chain().
    """

    GENESIS_HASH = "0" * 64     # sentinel hash for the first entry

    def __init__(self, log_path: str):
        self.log_path = log_path
        os.makedirs(os.path.dirname(log_path), exist_ok=True)
        self._entries: list[dict] = self._load()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def log(self, event: str, data: dict) -> dict:
        """Append a new event to the chain. Returns the created entry."""
        prev_hash = self._entries[-1]["hash"] if self._entries else self.GENESIS_HASH
        seq = len(self._entries)

        entry = {
            "seq":       seq,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "event":     event,
            "data":      data,
            "prev_hash": prev_hash,
            "hash":      "",        # filled below
        }
        entry["hash"] = self._compute_hash(entry)

        self._entries.append(entry)
        self._save()
        logger.info("Audit [%d] %s", seq, event)
        return entry

    def verify_chain(self) -> bool:
        """
        Re-compute every hash and confirm the chain is unbroken.
        Returns True if intact, False if tampered.
        """
        if not self._entries:
            return True

        for i, entry in enumerate(self._entries):
            # check prev_hash linkage
            expected_prev = self.GENESIS_HASH if i == 0 else self._entries[i - 1]["hash"]
            if entry["prev_hash"] != expected_prev:
                logger.error("Chain broken at seq %d — prev_hash mismatch", i)
                return False

            # recompute hash
            stored_hash = entry["hash"]
            recomputed  = self._compute_hash({**entry, "hash": ""})
            if stored_hash != recomputed:
                logger.error("Chain broken at seq %d — hash mismatch", i)
                return False

        logger.info("Audit chain verified — %d entries intact", len(self._entries))
        return True

    def get_log(self) -> list[dict]:
        return list(self._entries)

    # ------------------------------------------------------------------
    # Internals
    # ------------------------------------------------------------------

    def _compute_hash(self, entry: dict) -> str:
        """SHA-256 over the canonical JSON of the entry (hash field set to '')."""
        payload = json.dumps(entry, sort_keys=True, default=str).encode()
        return hashlib.sha256(payload).hexdigest()

    def _save(self) -> None:
        with open(self.log_path, "w") as f:
            json.dump(self._entries, f, indent=2, default=str)

    def _load(self) -> list[dict]:
        if os.path.exists(self.log_path):
            with open(self.log_path, "r") as f:
                return json.load(f)
        return []
