"""Render the measured paired deltas. Requires matplotlib; no network access."""
import json
import sys
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.lines import Line2D

source, target = map(Path, sys.argv[1:])
data = json.loads(source.read_text(encoding="utf-8"))
assert data["schema"] == "bnrose.ant-webrtc.comparison.v1"
assert len(data["groups"]) == 4
fig, ax = plt.subplots(figsize=(9, 5.4))
fig.subplots_adjust(left=0.25, right=0.96, top=0.76, bottom=0.22)
labels = []
for row, group in enumerate(data["groups"]):
    condition = "steady" if group["fault"] == "steady" else "withdraw / reconnect"
    labels.append(f'{group["load"]} concurrent\n{condition}')
    values = group["paired_deltas_percent"]
    for repeat, value in enumerate(values):
        ax.scatter(value, row + (repeat - 1) * 0.09, color="#167e9b", s=48, zorder=3)
    if values:
        ax.scatter(group["median_paired_delta_percent"], row,
                   marker="D", color="#182f48", s=62, zorder=4)
ax.axvline(0, color="#8191a1", linestyle="--", linewidth=1)
ax.set_yticks(range(4), labels)
ax.set_ylim(3.55, -0.55)
ax.grid(axis="x", color="#e3e9ee", linewidth=0.7)
ax.set_axisbelow(True)
ax.set_xlabel("Change in normal read-batch time (%)\nNegative: shadow faster     Positive: shadow slower",
              labelpad=12)
for side in ["top", "right", "left"]:
    ax.spines[side].set_visible(False)
ax.tick_params(axis="y", length=0, pad=12)
fig.text(0.07, 0.93, "BNRoSe observation on NixOS", fontsize=20, weight="bold", color="#182f48")
fig.text(0.07, 0.87, "Paired baseline / shadow trials · 3 planned pairs per cell · eligible pairs shown",
         fontsize=10, color="#4a5968")
handles = [Line2D([], [], marker="o", linestyle="", color="#167e9b", label="Individual pair"),
           Line2D([], [], marker="D", linestyle="", color="#182f48", label="Median paired change")]
fig.legend(handles=handles, loc="upper left", bbox_to_anchor=(0.24, 0.84),
           ncol=2, frameon=False, fontsize=9)
fig.text(0.07, 0.035,
         "Live ANT reads over WebRTC. Churn closes this client's associations; remote nodes remain untouched.\n"
         "Connection/setup and deliberately cancelled phase times are separate. Small, variable WAN sample.",
         fontsize=8.5, color="#4a5968")
fig.savefig(target, dpi=180, facecolor="white")
plt.close(fig)
