"""
Smoke tests that need no dataset and no trained model (torch is not required).
Run from the repo root:   python final/tests/test_basic.py
"""
import pickle, sys, tempfile
from pathlib import Path
import numpy as np

SRC = Path(__file__).resolve().parents[1] / "src"
sys.path.insert(0, str(SRC))


def test_metrics():
    from metrics import summarize
    s = summarize([0, 0, 0, 1, 2], [0, 0, 1, 1, 2], 3)
    assert abs(s["accuracy"] - 0.8) < 1e-9 and s["support"] == [3, 1, 1]


def test_indicators():
    from indicators import build_report, resp_rate_from_ppg
    fs = 64; t = np.arange(fs * 90) / fs
    ppg = np.sin(2 * np.pi * 1.2 * t) + 0.6 * np.sin(2 * np.pi * 0.25 * t)
    assert abs(resp_rate_from_ppg(ppg, fs) - 15.0) < 1.0
    r = build_report(probs=(0.2, 0.3, 0.5), ibi_ms=800 + np.random.randn(60) * 20, raw_ppg=ppg, fs=fs)
    status = {i["id"]: i["status"] for i in r["indicators"]}
    assert status["acute_stress"] == "model" and status["mito_oxidative"] == "unavailable"


def test_wesad_loader():
    from data.wesad_loader import load_wesad
    with tempfile.TemporaryDirectory() as d:
        (Path(d) / "S2").mkdir()
        lab = np.concatenate([np.full(300 * 700, 1), np.full(300 * 700, 2)])
        bvp = np.sin(2 * np.pi * 1.2 * np.arange(600 * 64) / 64)
        pickle.dump({"signal": {"wrist": {"BVP": bvp.reshape(-1, 1)}}, "label": lab}, open(Path(d) / "S2" / "S2.pkl", "wb"))
        w, l = load_wesad(d)["WESAD_S2"]["windows"]["E4_BVP"]
        assert w.shape[1] == 750 and set(np.unique(l)) == {0, 2}


def test_api_without_model():
    from fastapi.testclient import TestClient
    import api
    fs = 64; t = np.arange(fs * 70) / fs
    ppg = (np.sin(2 * np.pi * 1.2 * t) + 0.6 * np.sin(2 * np.pi * 0.25 * t)).tolist()
    c = TestClient(api.app)
    r = c.post("/report", json={"ppg": ppg, "fs": fs})
    assert r.status_code == 200 and any(i["id"] == "respiration" and i["status"] == "signal" for i in r.json()["indicators"])
    assert c.post("/report", json={"ppg": ppg[:100], "fs": fs}).status_code == 422


if __name__ == "__main__":
    for name, fn in list(globals().items()):
        if name.startswith("test_"):
            try:
                fn(); print("PASS", name)
            except ImportError as e:
                print("SKIP", name, "-", e)
