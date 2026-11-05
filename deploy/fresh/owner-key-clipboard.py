"""Owner workstation only: generate one fresh key directly into its clipboard.

No key is printed, logged, passed in command-line arguments or written to a file.
Do not run in Replit. Paste into the named Production Secret, then clear clipboard.
"""
import argparse
import os
import secrets
import shutil
import subprocess

SIZES = {"BQ_FRESH_SESSION_KEY": 48, "BQ_FRESH_BACKUP_KEY": 32, "BQ_FRESH_INSTALL_KEY": 32}
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("name", choices=SIZES)
args = parser.parse_args()
if os.environ.get("REPL_ID") or os.environ.get("REPLIT_DEPLOYMENT"):
    parser.exit(1, "Run only on the trusted owner workstation, not in Replit.\n")
command = next(([tool] + extra for tool, extra in [
    ("pbcopy", []), ("wl-copy", []), ("xclip", ["-selection", "clipboard"])
] if shutil.which(tool)), None)
if command is None:
    parser.exit(1, "No local clipboard utility found; use an approved cryptographic password manager.\n")
try:
    subprocess.run(command, input=secrets.token_hex(SIZES[args.name]), text=True,
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
except (OSError, subprocess.CalledProcessError):
    parser.exit(1, "Clipboard transfer failed. No key was printed or saved.\n")
print(args.name + ": copied securely; paste into Production app secrets, then clear clipboard.")
