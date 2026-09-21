# bViEw progressive first-frame (2026-09-21)

## Why
Live ANT `/stream` is still antd **0.12.0** DataMap stub (CL ~4170, ftyp + truncated moov, no mdat). The prior client waited on that stub then assembled the full JSON base64 Blob before paint. Warm ≤200 ms needs an honest progressive `/stream` (antd ≥0.12.1) plus a client that never burns a long stub wait.

## Client (surfaces/bview.html)
- Abort `/stream` when Content-Length < 128 KiB (stub class).
- Progressive JSON envelope: contiguous early Blob once moov + 256 KiB mdat are present; keep folding the rest.
- Ignore decode errors while the download bar is still up (truncated early snapshot).
- Device cache (`ant-bview-v1`) + tap-for-sound path kept.

## Door pin (ops/ant-node/antd.service)
- Pin **antd v0.12.1** arm64 sha `95bad9ad70d47f1f811c1836d0270be3e2e3ed233c81542d7da5d0a7bfe66676` PUBLIC-CONSTANT.

## Measured (pre door upgrade)
| Check | Result |
|---|---|
| Live `/stream` CL | still **4170** (stub) |
| Stub → envelope start | ~100 ms class (e2e) |
| e2e | **7/7** |
| Warm ≤200 ms on repro | **blocked** until door upgrade |

## Deploy on relay (stack seat that owns antd.service)
```bash
curl -fsSL -o /tmp/antd-linux-arm64 \
  https://github.com/WithAutonomi/ant-sdk/releases/download/v0.12.1/antd-linux-arm64
echo '95bad9ad70d47f1f811c1836d0270be3e2e3ed233c81542d7da5d0a7bfe66676  /tmp/antd-linux-arm64' | sha256sum -c -  # PUBLIC-CONSTANT
sudo install -m 755 /tmp/antd-linux-arm64 /home/ubuntu/ant-lane/antd
sudo cp ops/ant-node/antd.service /etc/systemd/system/antd.service
sudo systemctl daemon-reload && sudo systemctl restart antd
# health → version 0.12.1; /stream CL ≈ full object size (not 4170)
```
Then re-measure first-frame ms on the repro once the first chunk is warm.
