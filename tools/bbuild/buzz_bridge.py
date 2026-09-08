"""Buzz's existing NIP-98 HTTP bridge; private owner room, durable signed outbox."""
import base64
import hashlib
import json
from pathlib import Path
import urllib.request
import uuid

from nostr_sdk import EventBuilder, Keys, Kind, Tag


class Buzz:
    def __init__(self, key_file, channel, owner):
        self.keys = Keys.parse(Path(key_file).read_text().strip().split("=")[-1])
        self.channel, self.owner = channel, owner
        class NoRedirect(urllib.request.HTTPRedirectHandler):
            def redirect_request(self, *args, **kwargs):
                return None
        self.opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())

    def request(self, route, value):
        url = "https://skaists.buzz" + route
        body = json.dumps(value, separators=(",", ":")).encode()
        tags = [Tag.parse(["u", url]), Tag.parse(["method", "POST"]),
                Tag.parse(["nonce", str(uuid.uuid4())]),
                Tag.parse(["payload", hashlib.sha256(body).hexdigest()])]
        auth = EventBuilder(Kind(27235), "").tags(tags).sign_with_keys(self.keys)
        req = urllib.request.Request(url, data=body, headers={
            "Authorization": "Nostr " + base64.b64encode(auth.as_json().encode()).decode(),
            "Content-Type": "application/json"})
        with self.opener.open(req, timeout=20) as response:
            data = response.read(1024 * 1024 + 1)
        if len(data) > 1024 * 1024:
            raise ValueError("buzz_response_limit")
        return json.loads(data)

    def verify_room(self):
        meta = self.request("/query", [{"kinds": [39000], "#d": [self.channel], "limit": 1}])
        roster = self.request("/query", [{"kinds": [39002], "#d": [self.channel], "limit": 1}])
        if not meta or not roster or ["private"] not in meta[0]["tags"]:
            raise ValueError("private_owner_room_required")
        members = {t[1] for t in roster[0]["tags"] if t[0] == "p" and len(t) > 1}
        if members != {self.owner, self.keys.public_key().to_hex()}:
            raise ValueError("owner_room_members_changed")

    def event(self, text):
        self.verify_room()
        return json.loads(EventBuilder(Kind(9), text).tags([
            Tag.parse(["h", self.channel])]).sign_with_keys(self.keys).as_json())

    def deliver(self, event):
        # Recheck membership for each actual send; a stale private room may have
        # acquired another member. The caller persists this exact event first.
        self.verify_room()
        response = self.request("/events", event)
        if response.get("accepted") is not True:
            # A duplicate may be reported as already present after a crash.
            existing = self.request("/query", [{"ids": [event["id"]], "limit": 1}])
            if not any(e.get("id") == event["id"] for e in existing):
                raise ValueError("buzz_event_not_accepted")
        check = self.request("/query", [{"ids": [event["id"]], "limit": 1}])
        if not any(e.get("id") == event["id"] for e in check):
            raise ValueError("buzz_receipt_not_read_back")
        return event["id"]
