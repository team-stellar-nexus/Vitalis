"""
dataset.py — PyTorch Dataset class for the Ligo-HRV-Astronaut-Health windows.

Combines preprocessed windows from multiple participants and signals.
"""

import numpy as np
import torch
from torch.utils.data import Dataset, DataLoader, WeightedRandomSampler


class AstronautHealthDataset(Dataset):
    """
    PyTorch Dataset over 30-second biosignal windows with stress labels.

    Each item: (window_tensor, label)
    - window_tensor: float32 tensor of shape (750,)  [= 30s × 25Hz]
    - label: int tensor 0 / 1 / 2 (low / moderate / high stress)
    """

    def __init__(self, windows: np.ndarray, labels: np.ndarray, augment: bool = False):
        """
        Args:
            windows:  np.ndarray shape (N, 750)
            labels:   np.ndarray shape (N,)
            augment:  If True, apply random data augmentation (for training)
        """
        assert len(windows) == len(labels), "Mismatch between windows and labels"
        self.windows = torch.from_numpy(windows).float()
        self.labels  = torch.from_numpy(labels).long()
        self.augment = augment

    def __len__(self) -> int:
        return len(self.windows)

    def __getitem__(self, idx: int) -> tuple[torch.Tensor, torch.Tensor]:
        window = self.windows[idx].clone()
        label  = self.labels[idx]

        if self.augment:
            window = self._augment(window)

        return window, label

    def _augment(self, window: torch.Tensor) -> torch.Tensor:
        """Simple augmentations for biosignal data."""
        # Add Gaussian noise (simulates sensor noise)
        if torch.rand(1).item() > 0.5:
            window += torch.randn_like(window) * 0.02

        # Scale amplitude slightly (simulates different users)
        if torch.rand(1).item() > 0.5:
            scale = 0.9 + torch.rand(1).item() * 0.2   # 0.9 – 1.1
            window *= scale

        # Time shift by a few samples
        if torch.rand(1).item() > 0.5:
            shift = torch.randint(-20, 21, (1,)).item()
            window = torch.roll(window, shift)

        return window

    def class_weights(self) -> torch.Tensor:
        """Compute inverse-frequency class weights for balanced training."""
        label_np = self.labels.numpy()
        classes, counts = np.unique(label_np, return_counts=True)
        freq = counts / counts.sum()
        weights = 1.0 / (freq + 1e-8)
        weight_per_sample = torch.zeros(len(label_np))
        for cls, w in zip(classes, weights):
            weight_per_sample[label_np == cls] = w
        return weight_per_sample


def build_datasets(all_windows: dict, signal_key: str = "E4_BVP",
                   val_participants: list[str] = None,
                   test_participants: list[str] = None) -> tuple[Dataset, Dataset, Dataset]:
    """
    Split preprocessed windows into train / val / test datasets.

    Uses participant-level split (leave-one-out or explicit split) to avoid
    data leakage between train and eval.

    Args:
        all_windows: {participant_id: {signal_key: (windows, labels)}}
        signal_key: Which signal to use (e.g., 'E4_BVP', 'PolarH10_ECG')
        val_participants: Participant IDs to use for validation
        test_participants: Participant IDs to use for testing

    Returns:
        (train_dataset, val_dataset, test_dataset)
    """
    all_pids = list(all_windows.keys())

    if test_participants is None:
        test_participants = [all_pids[-1]]       # Last participant = test
    if val_participants is None:
        val_participants = [all_pids[-2]]         # Second-to-last = val

    train_pids = [p for p in all_pids if p not in val_participants and p not in test_participants]

    def collect(pids):
        all_win, all_lab = [], []
        for pid in pids:
            if pid not in all_windows:
                continue
            if signal_key not in all_windows[pid]["windows"]:
                print(f"  Warning: {signal_key} not found for {pid}")
                continue
            wins, labs = all_windows[pid]["windows"][signal_key]
            all_win.append(wins)
            all_lab.append(labs)
        if not all_win:
            return np.empty((0, 750), dtype=np.float32), np.empty((0,), dtype=np.int64)
        return np.concatenate(all_win), np.concatenate(all_lab)

    print(f"  Train: {train_pids}, Val: {val_participants}, Test: {test_participants}")

    train_w, train_l = collect(train_pids)
    val_w,   val_l   = collect(val_participants)
    test_w,  test_l  = collect(test_participants)

    print(f"  Train: {len(train_w)}, Val: {len(val_w)}, Test: {len(test_w)} windows")

    train_ds = AstronautHealthDataset(train_w, train_l, augment=True)
    val_ds   = AstronautHealthDataset(val_w,   val_l,   augment=False)
    test_ds  = AstronautHealthDataset(test_w,  test_l,  augment=False)

    return train_ds, val_ds, test_ds


def make_dataloader(dataset: Dataset, batch_size: int = 32,
                    balanced: bool = True, shuffle: bool = True) -> DataLoader:
    """
    Create a DataLoader, optionally with class-balanced sampling.

    Balanced sampling is crucial because stress events are rarer than rest.
    """
    if balanced and hasattr(dataset, "class_weights"):
        sampler = WeightedRandomSampler(
            weights=dataset.class_weights(),
            num_samples=len(dataset),
            replacement=True
        )
        return DataLoader(dataset, batch_size=batch_size, sampler=sampler)

    return DataLoader(dataset, batch_size=batch_size, shuffle=shuffle)


if __name__ == "__main__":
    # Dummy test
    N = 1000
    dummy_windows = np.random.randn(N, 750).astype(np.float32)
    dummy_labels  = np.random.randint(0, 3, N).astype(np.int64)

    ds = AstronautHealthDataset(dummy_windows, dummy_labels, augment=True)
    dl = make_dataloader(ds, batch_size=32)

    batch_x, batch_y = next(iter(dl))
    print(f"Batch X shape: {batch_x.shape}")
    print(f"Batch Y shape: {batch_y.shape}")
    print(f"Class distribution in batch: {batch_y.unique(return_counts=True)}")
