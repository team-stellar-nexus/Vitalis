# Data (download it, do not commit it)

| Dataset | Used for | Where |
|---|---|---|
| GalaxyPPG (Kaist-ICLab) | training the stress model | https://github.com/Kaist-ICLab/GalaxyPPG-Supplementary-Code (dataset link in its README) |
| WESAD | cross-dataset test, optional training, respiration validation | https://archive.ics.uci.edu/dataset/465/wesad+wearable+stress+and+affect+detection |

Check each dataset's license and citation requirements before submitting.
WESAD is for scientific, non-commercial use with credit to the authors.

## Expected layout
```
Dataset/P01..P24/{E4,PolarH10,GalaxyWatch}/*.csv + Event.csv   (GalaxyPPG)
WESAD/S2/S2.pkl ... S17/S17.pkl                                (S1, S12 are not usable)
```

## Not used for training (and why)
- MIMIC-III waveform subset: ICU fingertip PPG, no stress labels, terabytes.
- NASA OSDR (OSD-571/572/573/575): single time-point blood / microbiome assays from 4 crew members; no wearable signal.
They are cited as context only (see REFERENCES.md).
