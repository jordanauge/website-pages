#!/usr/bin/env bash
# NVIDIA 565.77 runfile + manual DKMS for Debian 14 / kernel 7.x
# Run on insomnia locally, or:
#   ssh gromit@192.168.0.163 'sudo bash -s' < install-nvidia-runfile.sh
set -euo pipefail

if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  echo "Run as root: sudo bash $0" >&2
  exit 1
fi

KERNEL="$(uname -r)"
DRIVER_VER="565.77"
BUILD_DIR="/usr/local/src/nvidia-build"
SRC_DIR="/usr/src/nvidia-${DRIVER_VER}"
RUNFILE="${BUILD_DIR}/NVIDIA-Linux-x86_64-${DRIVER_VER}.run"
RUNFILE_URL="https://fr.download.nvidia.com/XFree86/Linux-x86_64/${DRIVER_VER}/NVIDIA-Linux-x86_64-${DRIVER_VER}.run"

echo "=== Kernel: ${KERNEL} ==="
lspci | grep -i nvidia || { echo "No NVIDIA GPU"; exit 1; }
mokutil --sb-state 2>/dev/null || true

echo "=== 1. Prerequisites ==="
apt-get update
apt-get install -y build-essential gcc make dkms linux-headers-amd64 linux-image-amd64

# Debian 14 splits headers — ensure version.h and Module.symvers exist
HDR="/usr/src/linux-headers-${KERNEL}"
HDR_COMMON="/usr/src/linux-headers-${KERNEL%%+*}-common"
if [[ -d "${HDR_COMMON}" ]]; then
  for f in version.h Module.symvers; do
    if [[ ! -f "${HDR}/${f}" && -f "${HDR_COMMON}/${f}" ]]; then
      ln -sf "${HDR_COMMON}/${f}" "${HDR}/${f}"
    fi
  done
fi

echo "=== 2. Download runfile ==="
mkdir -p "${BUILD_DIR}"
cd "${BUILD_DIR}"
if [[ ! -f "${RUNFILE}" ]]; then
  wget -O "${RUNFILE}" "${RUNFILE_URL}"
fi
chmod +x "${RUNFILE}"

echo "=== 3. Extract + user-space install (no kernel module) ==="
rm -rf "${SRC_DIR}"
"${RUNFILE}" -x --target "${SRC_DIR}"
"${RUNFILE}" --no-kernel-module --silent --no-questions

echo "=== 4. Prepare DKMS tree ==="
if [[ -d "${SRC_DIR}/kernel" ]]; then
  cp -a "${SRC_DIR}/kernel/"* "${SRC_DIR}/"
fi

# Remove stale DKMS registration if re-running
dkms remove -m nvidia -v "${DRIVER_VER}" --all 2>/dev/null || true

echo "=== 5. DKMS build + install ==="
dkms add -m nvidia -v "${DRIVER_VER}"
dkms build -m nvidia -v "${DRIVER_VER}" --config "/boot/config-${KERNEL}"
dkms install -m nvidia -v "${DRIVER_VER}"

echo "=== 6. Load + validate ==="
/sbin/ldconfig
modprobe nvidia
nvidia-smi
dkms status | grep nvidia

echo "=== Done. Install nvidia-container-toolkit next. ==="
