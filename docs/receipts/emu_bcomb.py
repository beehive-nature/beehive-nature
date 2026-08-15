import sys
sys.path.insert(0, ".")
# Render a bComb frame on the real T3W1 framebuffer with NO firmware Rust.
# confirm_homescreen takes the JPEG directly, so no storage unlock is needed.
# Proves the optical link end to end:
#   bytes -> bComb -> JPEG -> device framebuffer -> PNG capture -> decoder -> bytes
import trezorui, trezorui_api

jpg = open("/home/travi/bcomb_home.jpg", "rb").read()
print("jpeg bytes:", len(jpg))
print("check_homescreen_format:", trezorui_api.check_homescreen_format(jpg))

d = trezorui.Display()
d.record_start(b"/home/travi/shots", 0)          # DIRECTORY, not a prefix

lay = trezorui_api.confirm_homescreen(title="bLighTnetWorK", image=jpg)
lay.attach_timer_fn(lambda t, dur: None, None)
lay.request_complete_repaint()
print("painted:", lay.paint())

d.record_stop()
print("done", d.WIDTH, "x", d.HEIGHT)
