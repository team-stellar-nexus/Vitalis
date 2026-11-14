import numpy as np
import pandas as pd
from scipy import signal as scipy_signal


# Constants for our pipeline
TARGET_SAMPLING_RATE = 25.0  # Hz
WINDOW_DURATION_SEC  = 30    # 30 seconds per training window
SAMPLES_PER_WINDOW   = int(TARGET_SAMPLING_RATE * WINDOW_DURATION_SEC) # 750 samples
WINDOW_OVERLAP_RATIO = 0.5   # 50% sliding window overlap
PER_WINDOW_NORM     = True   # z-score each 30 s window (same as the live API does)

# Zero-phase digital filter to remove baseline wander (<0.5 Hz)and high-frequency motion noise (>8 Hz or >40 Hz for ECG).
def apply_butterworth_bandpass(data_array: np.ndarray, fs: float, lowcut: float, highcut: float, order: int = 4) -> np.ndarray:
    nyquist_freq = fs / 2.0
    low = max(0.001, lowcut) / nyquist_freq
    high = min(0.999, highcut / nyquist_freq)

    b, a = scipy_signal.butter(order, [low, high], btype="band")
    filtered_data = scipy_signal.filtfilt(b, a, data_array)
    return filtered_data


# Value column per file type (E4: value | Polar HR: hr | IBI: duration | Galaxy HR: hr | SkinTemp: objectTemp)
_VALUE_COLUMNS = ["value", "hr", "duration", "objectTemp"]

def _pick_value_column(df: pd.DataFrame) -> str:
    for c in _VALUE_COLUMNS:
        if c in df.columns:
            return c
    skip = {"timestamp", "datareceived", "phonetimestamp", "sensortimestamp", "device", "signal", "participant_id", "status"}
    for c in df.columns:
        if c.lower() not in skip and pd.api.types.is_numeric_dtype(df[c]):
            return c
    raise KeyError(f"no value column in {list(df.columns)}")

# Standardizes signal: zero mean, unit variance.
def z_score_normalize(signal_array: np.ndarray) -> np.ndarray:
    std_val = np.std(signal_array)
    if std_val < 1e-7:
        return np.zeros_like(signal_array)
    return (signal_array - np.mean(signal_array)) / std_val


# Interpolates irregularly sampled sensor data onto a regular time grid.
def resample_to_uniform_grid(values: np.ndarray, timestamps: np.ndarray, target_fs: float = TARGET_SAMPLING_RATE) -> np.ndarray:

    if len(values) < 2 or len(timestamps) < 2:
        return values

    t_start = float(timestamps[0])
    t_end = float(timestamps[-1])
    duration = t_end - t_start

    if duration <= 0:
        return values

    num_target_samples = int(duration * target_fs)
    if num_target_samples < 2:
        return values

    t_uniform = np.linspace(t_start, t_end, num_target_samples)
    resampled_values = np.interp(t_uniform, timestamps, values)
    return resampled_values


#Looks up Event.csv to assign the correct stress label (0, 1, or 2) to a given 30-second window based on its timestamp.
def determine_window_label(window_center_time: float, events_df: pd.DataFrame) -> int:
    if events_df is None or len(events_df) == 0:
        return -1  # no event log -> unlabeled, window is dropped (e.g. P01)

    # Filter ENTER and EXIT rows
    enters = events_df[events_df["status"] == "ENTER"].sort_values("timestamp")
    exits = events_df[events_df["status"] == "EXIT"].sort_values("timestamp")

    for _, enter_row in enters.iterrows():
        session_name = enter_row["session"]
        t_enter = enter_row["timestamp"]

        matching_exit = exits[exits["session"] == session_name]
        if len(matching_exit) == 0:
            continue
        t_exit = matching_exit.iloc[0]["timestamp"]

        if t_enter <= window_center_time <= t_exit:
            return int(enter_row["stress_label"])

    return -1  # between sessions -> unlabeled, window is dropped


# Slides a 30-second window across the signal with 50% overlap. 
def generate_sliding_windows(preprocessed_signal: np.ndarray, start_timestamp: float, events_df: pd.DataFrame) -> tuple[np.ndarray, np.ndarray]:
    step_size = int(SAMPLES_PER_WINDOW * (1.0 - WINDOW_OVERLAP_RATIO))
    windows_list = []
    labels_list = []

    total_samples = len(preprocessed_signal)
    if total_samples < SAMPLES_PER_WINDOW:
        return np.empty((0, SAMPLES_PER_WINDOW), dtype=np.float32), np.empty((0,), dtype=np.int64)

    for start_idx in range(0, total_samples - SAMPLES_PER_WINDOW + 1, step_size):
        end_idx = start_idx + SAMPLES_PER_WINDOW
        window_chunk = preprocessed_signal[start_idx:end_idx]

        # Calculate timestamp at the center of this window
        center_offset_sec = (start_idx + (SAMPLES_PER_WINDOW / 2)) / TARGET_SAMPLING_RATE
        window_center_timestamp = start_timestamp + center_offset_sec

        label = determine_window_label(window_center_timestamp, events_df)
        if label < 0:          # unlabeled or excluded session (jogging/running)
            continue

        windows_list.append(z_score_normalize(window_chunk) if PER_WINDOW_NORM else window_chunk)
        labels_list.append(label)

    if not windows_list:
        return np.empty((0, SAMPLES_PER_WINDOW), dtype=np.float32), np.empty((0,), dtype=np.int64)
    return np.array(windows_list, dtype=np.float32), np.array(labels_list, dtype=np.int64)

WINDOW_SAMPLES = SAMPLES_PER_WINDOW


def preprocess_participant(profile: dict, pid: str = None) -> dict:
    """Name used by train.py."""
    return process_participant_signals(profile)


# Main entry point: takes a loaded participant profile and processes all raw signals into clean 25Hz normalized windows.
def process_participant_signals(participant_profile: dict) -> dict:
    raw_signals = participant_profile.get("signals", {})
    events_df = participant_profile.get("events", None)

    processed_output = {
        "participant": participant_profile.get("participant", "P_UNKNOWN"),
        "windows": {}
    }

    for sig_key, df in raw_signals.items():
        if df is None or len(df) == 0:
            continue

        try:
            timestamps = df["timestamp"].values.astype(float)

            # Determine signal type and apply appropriate filters
            if "BVP" in sig_key or "PPG" in sig_key:
                raw_vals = df["value" if "value" in df.columns else "ppg"].values.astype(float)
                filtered = apply_butterworth_bandpass(raw_vals, fs=64.0 if "BVP" in sig_key else 25.0, lowcut=0.5, highcut=8.0)
                resampled = resample_to_uniform_grid(filtered, timestamps, TARGET_SAMPLING_RATE)
            elif "ECG" in sig_key:
                raw_vals = df["ecg"].values.astype(float)
                filtered = apply_butterworth_bandpass(raw_vals, fs=130.0, lowcut=0.5, highcut=40.0)
                resampled = resample_to_uniform_grid(filtered, timestamps, TARGET_SAMPLING_RATE)
            elif "ACC" in sig_key:
                # Compute magnitude from x, y, z acceleration
                cols = {c.lower(): c for c in df.columns}      # Polar uses X,Y,Z; others x,y,z
                x = df[cols["x"]].values.astype(float)
                y = df[cols["y"]].values.astype(float)
                z = df[cols["z"]].values.astype(float)
                magnitude = np.sqrt(x**2 + y**2 + z**2)
                resampled = resample_to_uniform_grid(magnitude, timestamps, TARGET_SAMPLING_RATE)
            else:
                # Default for HR, TEMP, etc.
                val_col = _pick_value_column(df)
                raw_vals = df[val_col].values.astype(float)
                resampled = resample_to_uniform_grid(raw_vals, timestamps, TARGET_SAMPLING_RATE)

            normalized = z_score_normalize(resampled)

            # Generate sliding windows
            t_start = timestamps[0]
            wins, labs = generate_sliding_windows(normalized, t_start, events_df)

            processed_output["windows"][sig_key] = (wins, labs)

        except Exception as err:
            print(f"[WARNING] Failed processing signal {sig_key}: {type(err).__name__}: {err}")
            continue

    return processed_output
