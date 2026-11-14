import os
from pathlib import Path
import pandas as pd
import numpy as np

# Dictionary mapping our study event sessions to stress risk tiers
# 0 = Normal / Baseline / Rest
# 1 = Moderate Cognitive Load / Prep
# 2 = High Stress (TSST Speech / SSST Singing)
SESSION_STRESS_MAP = {
    "adaptation":      0,
    "baseline":        0,
    "rest-1":          0,
    "rest-2":          0,
    "rest-3":          0,
    "meditation-1":    0,
    "meditation-2":    0,
    "tsst-prep":       1,
    "tsst-speech":     2,   # Major acute stress trigger
    "screen-reading":  1,
    "ssst-prep":       1,
    "ssst-sing":       2,
    "keyboard-typing": 1,
    "mobile-typing":   1,
    "standing":        0,
    "walking":         1,
    "recovery":        0,
    "rest-4":          0,
    "rest-5":          0,
    # Physical exertion raises HR regardless of stress -> excluded (-1 = drop window)
    "jogging":        -1,
    "running":        -1,
}

# The PolarH10 phone clock runs ~9 h ahead of the E4 / GalaxyWatch / Event.csv clocks
# (looks like local KST time stored as UTC). Measured on P01, P02, P03, P05, P10, P15, P24: +8.95..8.99 h.
POLAR_CLOCK_OFFSET_SEC = 9 * 3600

# Custom data loader
class AstronautDataLoader:
    def __init__(self, base_data_dir: str):
        self.base_dir = Path(base_data_dir)
        if not self.base_dir.exists():
            raise FileNotFoundError(f"Whoops! Can't find data directory at: {self.base_dir}")
        
    # Scans dir and return list of participant folders
    def get_available_participants(self) -> list:
        return sorted([d.name for d in self.base_dir.iterdir() if d.is_dir() and d.name.startswith("P")])

    # Loads individual sensor CSV file + Cleans header whitespaces, normalises timestamps to Unix sec
    def load_sensor_csv(self, participant_id: str, device_name: str, signal_name: str) -> pd.DataFrame: 
        file_path = self.base_dir / participant_id / device_name / f"{signal_name}.csv"

        if not file_path.exists():
            return None

        df = pd.read_csv(file_path)
        df.columns = df.columns.str.strip()

        # Prefer an exact "timestamp" column (GalaxyWatch also has "dataReceived" = phone arrival
        # time, which must NOT be used). Otherwise fall back to the first timestamp-like column
        # (Polar ECG has phoneTimestamp, in ms).
        if "timestamp" not in df.columns:
            ts_col = next((c for c in df.columns
                           if any(k in c.lower() for k in ("timestamp", "timereceived", "datareceived"))), None)
            if ts_col:
                df = df.rename(columns={ts_col: "timestamp"})

        if "timestamp" in df.columns:
            first_val = float(df["timestamp"].iloc[0])
            if first_val > 1e15:
                # Empatica E4, microsecond timestamps -> seconds
                df["timestamp"] = df["timestamp"] / 1e6
            elif first_val > 1e12:
                # Millisecond timestamps -> seconds
                df["timestamp"] = df["timestamp"] / 1e3
        if device_name == "PolarH10" and "timestamp" in df.columns:
            df["timestamp"] = df["timestamp"] - POLAR_CLOCK_OFFSET_SEC   # align Polar clock with events/E4

        df["device"] = device_name
        df["signal"] = signal_name
        df["participant_id"] = participant_id

        return df

    # Loads Event.csv
    def load_participant_events(self, participant_id: str) -> pd.DataFrame:
        event_path = self.base_dir / participant_id / "Event.csv"
        if not event_path.exists():
            return None

        df = pd.read_csv(event_path)
        df.columns = df.columns.str.strip()

        if "timestamp" in df.columns:
            ts = float(df["timestamp"].iloc[0])
            if ts > 1e12:
                df["timestamp"] = df["timestamp"] / 1e3

        # Maps session names to numeric stress risk levels
        if "session" in df.columns:
            df["stress_label"] = df["session"].map(SESSION_STRESS_MAP).fillna(1).astype(int)

        return df

    # Loads all available sensors and event logs for a single participant into memory
    def load_complete_participant_profile(self, participant_id: str, only=None) -> dict:
        profile = {
            "participant": participant_id,
            "events": self.load_participant_events(participant_id),
            "signals": {}
        }

        devices_to_check = {
            "E4": ["BVP", "HR", "ACC", "IBI", "TEMP"],
            "PolarH10": ["ECG", "HR", "ACC", "IBI"],
            "GalaxyWatch": ["PPG", "HR", "ACC", "SkinTemp"]
        }

        for dev, signals in devices_to_check.items():
            for sig in signals:
                if only is not None and f"{dev}_{sig}" not in only:
                    continue        # e.g. only=["E4_BVP"] skips the big ECG/ACC files
                df = self.load_sensor_csv(participant_id, dev, sig)
                if df is not None:
                    profile["signals"][f"{dev}_{sig}"] = df

        return profile


def load_dataset(base_data_dir: str, only=None) -> dict:
    """Load every participant folder -> {pid: profile}."""
    loader = AstronautDataLoader(base_data_dir)
    out = {}
    for pid in loader.get_available_participants():
        print(f"  Loading {pid}")
        out[pid] = loader.load_complete_participant_profile(pid, only=only)
    return out


if __name__ == "__main__":
    # Quick test run
    print("[DEBUG] Testing AstronautDataLoader locally...")
    loader = AstronautDataLoader("Dataset")
    pids = loader.get_available_participants()
    print(f"Found participants: {pids}")

    if pids:
        sample_data = loader.load_complete_participant_profile(pids[0])
        print(f"Successfully loaded profile for {pids[0]}: {list(sample_data['signals'].keys())}")
