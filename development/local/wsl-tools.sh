#!/usr/bin/env bash
# Installs Node.js 22 and PostgreSQL 16 for the isolated development runtime into
# a user directory (default ~/.local/bq-tools) on WSL2 Ubuntu 24.04, without root.
# Downloads are verified: Node against SHASUMS256.txt, PostgreSQL packages against
# the gpg-verified Ubuntu archive index. Afterwards: source ~/.local/bq-tools/env.sh
set -euo pipefail

dest="${BQ_TOOLS:-$HOME/.local/bq-tools}"
archive="http://archive.ubuntu.com/ubuntu"
suite="noble-updates"
mkdir -p "$dest/dl"
cd "$dest/dl"

node_base="https://nodejs.org/dist/latest-v22.x"
curl -fsSL "$node_base/SHASUMS256.txt" -o SHASUMS256.txt
tarball=$(grep -oE 'node-v22\.[0-9.]+-linux-x64\.tar\.xz' SHASUMS256.txt | head -1)
[ -f "$tarball" ] || curl -fsSL "$node_base/$tarball" -o "$tarball"
grep " $tarball\$" SHASUMS256.txt | sha256sum -c --quiet -
rm -rf "$dest/node"
mkdir -p "$dest/node"
tar -xJf "$tarball" -C "$dest/node" --strip-components=1

curl -fsSL "$archive/dists/$suite/InRelease" -o InRelease
gpgv --keyring /usr/share/keyrings/ubuntu-archive-keyring.gpg InRelease 2>/dev/null
curl -fsSL "$archive/dists/$suite/main/binary-amd64/Packages.gz" -o Packages.gz
index_sum=$(awk '/^SHA256:/{s=1;next} /^[A-Za-z]/{s=0} s && $3=="main/binary-amd64/Packages.gz"{print $1}' InRelease)
echo "$index_sum  Packages.gz" | sha256sum -c --quiet -
zcat Packages.gz > Packages

rm -rf "$dest/pg"
for pkg in postgresql-16 postgresql-client-16 libpq5; do
  line=$(awk -v p="$pkg" 'BEGIN{RS="";FS="\n"} {
      n=v=f=s=""
      for(i=1;i<=NF;i++){ k=$i; sub(/: .*/,"",k); val=$i; sub(/^[^:]*: /,"",val)
        if(k=="Package")n=val; else if(k=="Version")v=val; else if(k=="Filename")f=val; else if(k=="SHA256")s=val }
      if(n==p) print v" "f" "s }' Packages | sort -V | tail -1)
  [ -n "$line" ] || { echo "Package $pkg not found in $suite" >&2; exit 1; }
  read -r version file sum <<<"$line"
  deb=$(basename "$file")
  [ -f "$deb" ] || curl -fsSL "$archive/$file" -o "$deb"
  echo "$sum  $deb" | sha256sum -c --quiet -
  dpkg-deb -x "$deb" "$dest/pg"
  echo "$pkg $version"
done

pgbin="$dest/pg/usr/lib/postgresql/16/bin"
pglib="$dest/pg/usr/lib/x86_64-linux-gnu"
# The harness launches PostgreSQL tools with an environment reduced to PATH/HOME/LANG,
# so each wrapper carries the private libpq path itself.
rm -rf "$dest/bin"
mkdir -p "$dest/bin"
for b in "$pgbin"/*; do
  name=$(basename "$b")
  printf '#!/bin/sh\nLD_LIBRARY_PATH="%s${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}" exec "%s" "$@"\n' "$pglib" "$b" > "$dest/bin/$name"
  chmod 755 "$dest/bin/$name"
done
cat > "$dest/env.sh" <<EOF
export PATH="$dest/node/bin:$dest/bin:\$PATH"
EOF

missing=$(for b in "$pgbin"/*; do LD_LIBRARY_PATH="$pglib" ldd "$b" 2>/dev/null | grep 'not found' || true; done | sort -u)
if [ -n "$missing" ]; then echo "Missing shared libraries:"; echo "$missing"; exit 1; fi

# shellcheck disable=SC1091
source "$dest/env.sh"
echo "node $(node --version), npm $(npm --version)"
initdb --version
echo "Ready: source $dest/env.sh"
