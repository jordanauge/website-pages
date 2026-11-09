#!/usr/bin/env bash
# Install NVIDIA open driver on Debian 14 + kernel 7.x (insomnia / RTX 3080).
# Run locally on the server, or from your Mac:
#   ssh gromit@192.168.0.163 'sudo bash -s' < install-nvidia-driver.sh
set -euo pipefail

if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  echo "Run as root (sudo bash $0)" >&2
  exit 1
fi

KERNEL="$(uname -r)"
echo "=== Kernel: ${KERNEL} ==="

echo "=== 1. Diagnose ==="
lspci | grep -i nvidia || { echo "No NVIDIA GPU found"; exit 1; }
dkms status 2>/dev/null || true
mokutil --sb-state 2>/dev/null || echo "mokutil not available"
nvidia-smi 2>/dev/null || echo "nvidia-smi not working yet (expected)"

echo "=== 2. Enable non-free firmware in APT ==="
if ! grep -qrE 'non-free-firmware' /etc/apt/sources.list /etc/apt/sources.list.d/ 2>/dev/null; then
  CODENAME="$(. /etc/os-release && echo "${VERSION_CODENAME:-trixie}")"
  echo "deb http://deb.debian.org/debian ${CODENAME} main contrib non-free non-free-firmware" \
    > /etc/apt/sources.list.d/non-free-firmware.list
fi

echo "=== 3. Remove broken Debian nvidia packages (550.x won't build on kernel 7.x) ==="
apt-get purge -y 'nvidia-*' 'libnvidia-*' 2>/dev/null || true
apt-get autoremove -y

echo "=== 4. Add NVIDIA CUDA apt repo (driver 595+ for kernel 7.x) ==="
TMPDIR="$(mktemp -d)"
cd "${TMPDIR}"
wget -q https://developer.download.nvidia.com/compute/cuda/repos/debian13/x86_64/cuda-keyring_1.1-1_all.deb
dpkg -i cuda-keyring_1.1-1_all.deb
rm -rf "${TMPDIR}"

apt-get update
apt-get install -y \
  build-essential \
  dkms \
  linux-headers-amd64 \
  firmware-misc-nonfree

echo "=== 5. Install open kernel modules (RTX 3080 / Ampere+) ==="
apt-get install -y nvidia-open nvidia-driver nvidia-smi

echo "=== 6. DKMS status ==="
dkms status

echo "=== 7. Load module ==="
modprobe nvidia 2>/dev/null || {
  echo
  echo "modprobe failed. If Secure Boot is enabled, enroll the DKMS MOK key at next reboot:"
  echo "  mokutil --import /var/lib/shim-signed/mok/MOK.der"
  echo "  reboot, then complete MOK Manager enrollment"
  exit 1
}

echo "=== 8. Validate ==="
nvidia-smi
dpkg -l | grep -E 'nvidia-driver|nvidia-open' | head -5

echo
echo "Host driver OK. Next: install nvidia-container-toolkit and test Docker GPU access."
