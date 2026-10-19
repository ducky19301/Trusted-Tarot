#!/usr/bin/env python3
"""Create or reset the phone-access password for public_proxy.py.

    python3 public_auth_setup.py            # create data/public-auth.json if missing
    python3 public_auth_setup.py --reset    # new password + new cookie secret (logs out every device)

The new password is printed ONCE to stdout and is never written to disk;
only a PBKDF2-SHA256 hash and a random cookie secret are stored (chmod 600).
"""
import hashlib
import json
import os
import secrets
import sys
import tempfile
from datetime import datetime
from pathlib import Path

AUTH_FILE = Path(os.environ.get("TAROT_PUBLIC_AUTH", Path(__file__).resolve().parent / "data" / "public-auth.json"))
ITERATIONS = 600_000

WORDS = """
amber anchor apple arrow aspen autumn badge bamboo banner basil beacon berry birch blossom bramble breeze brook
cabin cactus camel candle canyon canvas cedar cello chalk cherry chimney cider cinder citrus clover cobalt comet
copper coral cotton cove crane crater crystal cypress daisy dawn delta desert dew dolphin dove dragon drift dune
eagle echo ember emerald falcon fable feather fern ferry fiddle fig finch fjord flame flint forest fossil fox
frost galaxy garden garnet gazelle geyser ginger glacier glade globe granite grove gull harbor harp hazel heron
hollow honey horizon indigo iris island ivory ivy jade jasmine jasper juniper kayak kettle kite koala lagoon
lantern lark laurel lava lemon lilac lily linen lotus lunar lynx magnet mango maple marble marsh meadow melon
mesa meteor mint mist moss moth nectar needle nest nimbus north nova oak oasis ocean olive onyx opal orbit
orchid otter owl paddle palm panda paper pebble pepper petal pine planet plum pollen pond poppy prairie prism
quartz quill rain raven reef ridge river robin rose ruby saffron sage sail salmon sapphire satin savanna
scarlet shell sierra silk silver sketch sky slate snow solar sparrow spruce star stone storm summit sun swan
thistle thunder tide tiger timber topaz tulip tundra twilight valley velvet violet voyage walnut willow wind
winter wren yarrow zephyr zinnia acorn alpine atlas aurora bay bell bison bluebird bonfire breeze cameo
caramel carbon cascade castle cedar celery charm chestnut cinnamon cloud compass cocoa cosmos crescent daffodil
denim dusk elm fawn firefly fleece flute garnet glow gold gondola harvest heather hummingbird igloo jelly
jewel juniper kiwi lemonade lighthouse maize mariner meadowlark mocha monarch mosaic nutmeg orange oriole
paprika parrot peach pearl pelican penguin peony pinecone pistachio quail radish rainbow ripple rocket
sequoia shadow sorrel spice spiral squirrel starling sunset tangerine teal toffee torch trellis tulip
turtle umber vanilla vapor walrus wave whisper wildflower yonder
""".split()
WORDS = sorted(set(w for w in WORDS if 3 <= len(w) <= 8))


def new_password():
    return "".join(secrets.choice(WORDS) for _ in range(3)) + f"{secrets.randbelow(90) + 10}"


def write(data):
    AUTH_FILE.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix=".public-auth.", dir=str(AUTH_FILE.parent))
    with os.fdopen(fd, "w") as f:
        json.dump(data, f, indent=2)
        f.write("\n")
    os.chmod(tmp, 0o600)
    os.replace(tmp, AUTH_FILE)


def main():
    reset = "--reset" in sys.argv
    if AUTH_FILE.exists() and not reset:
        print(f"{AUTH_FILE} already exists; use --reset to make a new password.")
        return
    old_epoch = 0
    if AUTH_FILE.exists():
        old_epoch = int(json.loads(AUTH_FILE.read_text()).get("session_epoch", 0))
    pw = new_password()
    salt = secrets.token_bytes(16)
    dk = hashlib.pbkdf2_hmac("sha256", pw.encode(), salt, ITERATIONS)
    write({
        "note": "Phone-access gate for public_proxy.py. Only a hash is stored; reset with public_auth_setup.py --reset",
        "password": {"algo": "pbkdf2_sha256", "iterations": ITERATIONS, "salt": salt.hex(), "hash": dk.hex()},
        "cookie_secret": secrets.token_hex(32),
        "session_epoch": old_epoch + 1,
        "created": datetime.now().astimezone().isoformat(timespec="seconds"),
    })
    print(f"New phone password (shown once, not saved): {pw}")
    print(f"({len(WORDS)}-word list, about {len(WORDS)**3 * 90:.1e} combinations)")


if __name__ == "__main__":
    main()
