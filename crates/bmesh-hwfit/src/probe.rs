//! Node-fitness preflight probe — can THIS machine host an antnode role?
//!
//! Per ORDER zA (SPRINT-2026-08-23-N): three checks, each returning a typed
//! verdict — never a bool, never a panic:
//!
//! 1. `VA_BITS` — `CONFIG_ARM64_VA_BITS` from the running kernel's config
//!    (`/proc/config.gz`, else `/boot/config-$(uname -r)`). 39-bit VA is a
//!    512 GiB user address space where large mmap reservations cannot map
//!    → Fail. 48/52 → Pass. Config absent or non-ARM64 kernel → Unknown,
//!    stated as Unknown, never assumed Pass.
//! 2. `PAGE SIZE` — `sysconf(_SC_PAGESIZE)`. 4096 or 16384 → Pass with the
//!    value recorded; anything else → Unknown.
//! 3. `DISK READ-AHEAD SANITY` — `read_ahead_kb` (and `optimal_io_size`,
//!    recorded) from the data dir's block device queue. `read_ahead_kb`
//!    above 1024 KiB → Fail naming the udev-rule fix and that the node
//!    must be restarted (the cap is captured at file open).
//!
//! All classification lives in pure functions over `&str`/integers so the
//! tests parse FIXTURE STRINGS — hermetic, nothing reads the live machine.
//! The live I/O layer (`preflight` and its readers) is Linux-only; on other
//! platforms the pure classifiers remain available and the crate compiles
//! without the sysfs/procfs layer.

use std::fmt;

#[cfg(target_os = "linux")]
use std::path::Path;

/// Typed outcome of one preflight check. Never a bool: "could not
/// determine" is `Unknown`, never an assumed `Pass`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Verdict {
    /// Check ran; the machine is fit for this dimension. `note` records
    /// the measured value(s).
    Pass {
        note: String,
    },
    /// Check ran; the machine is NOT fit. `reason` names the fix in
    /// human-readable words.
    Fail {
        reason: String,
    },
    /// Check could not run or its result is unclassified on this host.
    /// `why` states what was missing.
    Unknown {
        why: String,
    },
}

impl fmt::Display for Verdict {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Verdict::Pass { note } => write!(f, "PASS — {note}"),
            Verdict::Fail { reason } => write!(f, "FAIL — {reason}"),
            Verdict::Unknown { why } => write!(f, "UNKNOWN — {why}"),
        }
    }
}

/// The three preflight verdicts, one row per check.
#[derive(Debug, Clone)]
pub struct PreflightReport {
    pub va_bits: Verdict,
    pub page_size: Verdict,
    pub read_ahead: Verdict,
}

impl fmt::Display for PreflightReport {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        writeln!(f, "VA_BITS: {}", self.va_bits)?;
        writeln!(f, "PAGE SIZE: {}", self.page_size)?;
        write!(f, "DISK READ-AHEAD: {}", self.read_ahead)
    }
}

// --- pure classifiers (hermetic; tests parse fixture strings) -----------

/// Exact-match lookup in kernel-config text: `KEY=value` lines, where the
/// key is everything before the first `=`. `# ... is not set` lines never
/// match because their leading `#` is part of the key.
fn config_value<'a>(config: &'a str, key: &str) -> Option<&'a str> {
    config
        .lines()
        .filter_map(|line| line.split_once('='))
        .find(|(k, _)| *k == key)
        .map(|(_, v)| v.trim())
}

/// Check 1 — VA_BITS, classified from kernel-config text.
///
/// `None` means no kernel-config source was readable on this host
/// (`/proc/config.gz` absent and `/boot/config-$(uname -r)` absent).
pub fn va_bits_verdict(config: Option<&str>) -> Verdict {
    let Some(config) = config else {
        return Verdict::Unknown {
            why: "no kernel config readable on this host (tried /proc/config.gz and \
                  /boot/config-$(uname -r)) — VA_BITS cannot be determined"
                .to_string(),
        };
    };
    if config_value(config, "CONFIG_ARM64") != Some("y") {
        return Verdict::Unknown {
            why: "kernel config has no CONFIG_ARM64=y — not an ARM64 kernel, and the \
                  VA_BITS check is arm64-only"
                .to_string(),
        };
    }
    let Some(raw) = config_value(config, "CONFIG_ARM64_VA_BITS") else {
        return Verdict::Unknown {
            why: "CONFIG_ARM64=y but CONFIG_ARM64_VA_BITS is not present in the kernel \
                  config — VA_BITS cannot be determined"
                .to_string(),
        };
    };
    match raw.parse::<u32>() {
        Ok(39) => Verdict::Fail {
            reason: "CONFIG_ARM64_VA_BITS=39 caps user address space at 512 GiB — large \
                     mmap reservations cannot map. Fix: run a kernel built with 48-bit \
                     (or 52-bit) VA, i.e. CONFIG_ARM64_VA_BITS=48/52 — for example a \
                     distro arm64 kernel; this is fixed at kernel build/boot time and \
                     cannot be raised at runtime"
                .to_string(),
        },
        Ok(48) => Verdict::Pass {
            note: "CONFIG_ARM64_VA_BITS=48 — 256 TiB user address space".to_string(),
        },
        Ok(52) => Verdict::Pass {
            note: "CONFIG_ARM64_VA_BITS=52 — 4 PiB user address space".to_string(),
        },
        Ok(other) => Verdict::Unknown {
            why: format!(
                "CONFIG_ARM64_VA_BITS={other} is not a classified value (39 fails, \
                 48/52 pass) — refusing to assume Pass"
            ),
        },
        Err(_) => Verdict::Unknown {
            why: format!(
                "CONFIG_ARM64_VA_BITS=\"{raw}\" is not an integer — VA_BITS cannot be \
                 determined"
            ),
        },
    }
}

/// Check 2 — page size, classified from the `sysconf(_SC_PAGESIZE)` value.
/// Non-positive values are sysconf's error shape (`-1`).
pub fn page_size_verdict(page_size: i64) -> Verdict {
    match page_size {
        4096 => Verdict::Pass {
            note: "page size 4096 bytes (4 KiB)".to_string(),
        },
        16384 => Verdict::Pass {
            note: "page size 16384 bytes (16 KiB)".to_string(),
        },
        n if n <= 0 => Verdict::Unknown {
            why: format!(
                "sysconf(_SC_PAGESIZE) returned {n} — page size unavailable on this host"
            ),
        },
        n => Verdict::Unknown {
            why: format!(
                "page size {n} bytes is neither 4 KiB nor 16 KiB — unclassified, \
                 refusing to assume Pass"
            ),
        },
    }
}

/// Check 3 — disk read-ahead sanity, classified from the data dir's block
/// device queue. `device` names the block device (it appears inside the
/// udev-rule remediation); `None` means the sysfs file was not
/// present/readable. `optimal_io_size` is read alongside and recorded.
pub fn read_ahead_verdict(
    device: &str,
    read_ahead_kb: Option<&str>,
    optimal_io_size: Option<&str>,
) -> Verdict {
    let Some(raw) = read_ahead_kb else {
        return Verdict::Unknown {
            why: format!(
                "/sys/block/{device}/queue/read_ahead_kb is not readable — cannot \
                 judge disk read-ahead"
            ),
        };
    };
    let kb = match raw.trim().parse::<u64>() {
        Ok(kb) => kb,
        Err(_) => {
            return Verdict::Unknown {
                why: format!(
                    "read_ahead_kb=\"{}\" on {device} is not an integer — cannot judge \
                     disk read-ahead",
                    raw.trim()
                ),
            };
        }
    };
    if kb > 1024 {
        return Verdict::Fail {
            reason: format!(
                "read_ahead_kb={kb} KiB on {device} exceeds the 1024 KiB cap — kernel \
                 read-ahead this large swamps the random reads a node data dir does. \
                 Fix: pin the cap with a udev rule (ACTION==\"add|change\", \
                 KERNEL==\"{device}\", ATTR{{queue/read_ahead_kb}}=\"1024\") and restart \
                 the node once the rule lands — the cap is captured at file open, so a \
                 running node keeps its oversized read-ahead until restarted."
            ),
        };
    }
    let optimal_note = match optimal_io_size.map(str::trim) {
        Some(v) if v.parse::<i64>().is_ok() => format!("optimal_io_size={v} bytes"),
        Some(_) => "optimal_io_size=unparseable".to_string(),
        None => "optimal_io_size=not present".to_string(),
    };
    Verdict::Pass {
        note: format!("read_ahead_kb={kb} KiB (cap 1024), {optimal_note}"),
    }
}

// --- live I/O layer (Linux-only; the classifiers above stay hermetic) ---

#[cfg(target_os = "linux")]
use std::os::unix::fs::MetadataExt;

/// Run all three checks against THIS machine. `data_dir` is where the node
/// would keep its data; it does not have to exist yet — its nearest
/// existing ancestor is probed, since that is where the data would land.
#[cfg(target_os = "linux")]
pub fn preflight(data_dir: &Path) -> PreflightReport {
    let read_ahead = match data_dir_block_device(data_dir) {
        Some(device) => {
            let queue_file = |name: &str| {
                std::fs::read_to_string(format!("/sys/block/{device}/queue/{name}")).ok()
            };
            read_ahead_verdict(
                &device,
                queue_file("read_ahead_kb").as_deref(),
                queue_file("optimal_io_size").as_deref(),
            )
        }
        None => Verdict::Unknown {
            why: format!(
                "could not resolve the block device behind {} (no /sys/dev/block entry \
                 for its device number) — cannot judge disk read-ahead",
                data_dir.display()
            ),
        },
    };
    PreflightReport {
        va_bits: va_bits_verdict(read_kernel_config().as_deref()),
        page_size: page_size_verdict(sysconf_page_size()),
        read_ahead,
    }
}

/// `/proc/config.gz` first (always matches the running kernel), then the
/// `/boot/config-$(uname -r)` copy. `None` = neither source readable.
#[cfg(target_os = "linux")]
fn read_kernel_config() -> Option<String> {
    use flate2::read::GzDecoder;
    use std::io::Read as _;

    if let Ok(gz) = std::fs::read("/proc/config.gz") {
        let mut text = String::new();
        if GzDecoder::new(gz.as_slice())
            .read_to_string(&mut text)
            .is_ok()
        {
            return Some(text);
        }
    }
    let release = std::fs::read_to_string("/proc/sys/kernel/osrelease").ok()?;
    std::fs::read_to_string(format!("/boot/config-{}", release.trim())).ok()
}

#[cfg(target_os = "linux")]
fn sysconf_page_size() -> i64 {
    // SAFETY: sysconf(_SC_*) has no memory-safety contract to uphold; its
    // error shape is the -1 return, which the classifier reports as Unknown.
    unsafe { libc::sysconf(libc::_SC_PAGESIZE) }
}

/// glibc `dev_t` bit layout (sysmacros.h) — glibc already expands the
/// kernel's packed dev_t when it fills `st_dev`.
#[cfg(target_os = "linux")]
fn dev_major(dev: u64) -> u64 {
    ((dev >> 8) & 0xfff) | ((dev >> 32) & !0xfff)
}

#[cfg(target_os = "linux")]
fn dev_minor(dev: u64) -> u64 {
    (dev & 0xff) | ((dev >> 12) & !0xff)
}

/// Whole-disk name behind `dir` (partition stripped): canonicalize the
/// `/sys/dev/block/<maj>:<min>` link, then take the deepest ancestor that
/// has a `/sys/block/<name>` twin resolving to it.
#[cfg(target_os = "linux")]
fn block_device_of(dir: &Path) -> Option<String> {
    let dev = std::fs::metadata(dir).ok()?.dev();
    let link = Path::new("/sys/dev/block").join(format!(
        "{}:{}",
        dev_major(dev),
        dev_minor(dev)
    ));
    let real = std::fs::canonicalize(link).ok()?;
    for ancestor in real.ancestors() {
        if let Some(name) = ancestor.file_name().and_then(std::ffi::OsStr::to_str) {
            let twin = Path::new("/sys/block").join(name);
            if std::fs::canonicalize(&twin).ok().as_deref() == Some(ancestor) {
                return Some(name.to_owned());
            }
        }
    }
    None
}

#[cfg(target_os = "linux")]
fn data_dir_block_device(data_dir: &Path) -> Option<String> {
    let existing = data_dir
        .ancestors()
        .find(|p| std::fs::metadata(p).is_ok())?;
    block_device_of(existing)
}

#[cfg(test)]
mod tests {
    use super::*;

    // FIXTURE STRINGS — every test below parses these, never the live
    // machine, so the suite is hermetic and platform-independent.

    const ARM64_CONFIG_VA39: &str = "\
# Automatically generated file; DO NOT EDIT.
CONFIG_64BIT=y
CONFIG_ARM64=y
CONFIG_ARM64_PAGE_SHIFT=12
CONFIG_ARM64_CONT_PTE_SHIFT=4
CONFIG_ARM64_VA_BITS=39
CONFIG_ARCH_MMAP_RND_BITS_MIN=18
";

    const ARM64_CONFIG_VA48: &str = "\
# Automatically generated file; DO NOT EDIT.
CONFIG_64BIT=y
CONFIG_ARM64=y
CONFIG_ARM64_PAGE_SHIFT=12
CONFIG_ARM64_VA_BITS=48
CONFIG_ARM64_VA_BITS_52=y
";

    const ARM64_CONFIG_VA52: &str = "\
CONFIG_ARM64=y
CONFIG_ARM64_VA_BITS=52
";

    const ARM64_CONFIG_NO_VA_BITS: &str = "\
CONFIG_ARM64=y
CONFIG_ARM64_PAGE_SHIFT=16
";

    const ARM64_CONFIG_VA47: &str = "CONFIG_ARM64=y\nCONFIG_ARM64_VA_BITS=47\n";

    const X86_CONFIG: &str = "\
CONFIG_64BIT=y
CONFIG_X86_64=y
CONFIG_X86_5LEVEL=y
";

    #[test]
    fn va_bits_39_fails_naming_the_cap_and_the_fix() {
        let Verdict::Fail { reason } = va_bits_verdict(Some(ARM64_CONFIG_VA39)) else {
            panic!("39-bit VA must Fail, never Pass or Unknown");
        };
        assert!(reason.contains("512 GiB"), "names the cap: {reason}");
        assert!(
            reason.contains("CONFIG_ARM64_VA_BITS=48"),
            "names the fix: {reason}"
        );
    }

    #[test]
    fn va_bits_48_passes() {
        let Verdict::Pass { note } = va_bits_verdict(Some(ARM64_CONFIG_VA48)) else {
            panic!("48-bit VA must Pass");
        };
        assert!(note.contains("48"), "records the value: {note}");
    }

    #[test]
    fn va_bits_52_passes() {
        let Verdict::Pass { note } = va_bits_verdict(Some(ARM64_CONFIG_VA52)) else {
            panic!("52-bit VA must Pass");
        };
        assert!(note.contains("52"), "records the value: {note}");
    }

    #[test]
    fn kernel_config_file_absent_is_unknown() {
        let Verdict::Unknown { why } = va_bits_verdict(None) else {
            panic!("absent config must be Unknown, never assumed Pass");
        };
        assert!(
            why.contains("/proc/config.gz") && why.contains("/boot/config-"),
            "states where it looked: {why}"
        );
    }

    #[test]
    fn non_arm64_kernel_is_unknown() {
        let Verdict::Unknown { why } = va_bits_verdict(Some(X86_CONFIG)) else {
            panic!("non-ARM64 kernel must be Unknown");
        };
        assert!(why.contains("CONFIG_ARM64"), "{why}");
    }

    #[test]
    fn arm64_without_va_bits_key_is_unknown() {
        let Verdict::Unknown { why } = va_bits_verdict(Some(ARM64_CONFIG_NO_VA_BITS)) else {
            panic!("missing CONFIG_ARM64_VA_BITS must be Unknown");
        };
        assert!(why.contains("CONFIG_ARM64_VA_BITS"), "{why}");
    }

    #[test]
    fn unclassified_va_bits_value_is_unknown() {
        let Verdict::Unknown { why } = va_bits_verdict(Some(ARM64_CONFIG_VA47)) else {
            panic!("47-bit VA is unclassified and must be Unknown, not assumed Pass");
        };
        assert!(why.contains("47"), "{why}");
    }

    #[test]
    fn read_ahead_65532_fails_naming_udev_rule_and_restart() {
        let Verdict::Fail { reason } = read_ahead_verdict("sda", Some("65532\n"), Some("0\n"))
        else {
            panic!("read_ahead_kb=65532 must Fail");
        };
        assert!(reason.contains("udev"), "names the udev rule: {reason}");
        assert!(
            reason.contains("KERNEL==\"sda\""),
            "rule names the device: {reason}"
        );
        assert!(reason.contains("restart"), "names the restart: {reason}");
        assert!(
            reason.contains("file open"),
            "names why restart is needed: {reason}"
        );
    }

    #[test]
    fn read_ahead_16_passes() {
        let Verdict::Pass { note } =
            read_ahead_verdict("nvme0n1", Some("16\n"), Some("33553920\n"))
        else {
            panic!("read_ahead_kb=16 must Pass");
        };
        assert!(note.contains("16"), "records the value: {note}");
        assert!(
            note.contains("optimal_io_size=33553920 bytes"),
            "records optimal_io_size: {note}"
        );
    }

    #[test]
    fn read_ahead_cap_boundary_1024_passes_1025_fails() {
        assert!(matches!(
            read_ahead_verdict("sda", Some("1024\n"), None),
            Verdict::Pass { .. }
        ));
        assert!(matches!(
            read_ahead_verdict("sda", Some("1025\n"), None),
            Verdict::Fail { .. }
        ));
    }

    #[test]
    fn read_ahead_file_absent_is_unknown() {
        let Verdict::Unknown { why } = read_ahead_verdict("sda", None, None) else {
            panic!("unreadable sysfs must be Unknown");
        };
        assert!(why.contains("read_ahead_kb"), "{why}");
    }

    #[test]
    fn read_ahead_garbage_value_is_unknown() {
        let Verdict::Unknown { why } =
            read_ahead_verdict("sda", Some("auto\n"), Some("0\n"))
        else {
            panic!("non-integer read_ahead_kb must be Unknown");
        };
        assert!(why.contains("auto"), "{why}");
    }

    #[test]
    fn page_size_4096_passes_with_value_recorded() {
        let Verdict::Pass { note } = page_size_verdict(4096) else {
            panic!("4 KiB pages must Pass");
        };
        assert!(note.contains("4096"), "{note}");
    }

    #[test]
    fn page_size_16384_passes_with_value_recorded() {
        let Verdict::Pass { note } = page_size_verdict(16384) else {
            panic!("16 KiB pages must Pass");
        };
        assert!(note.contains("16384"), "{note}");
    }

    #[test]
    fn page_size_unclassified_value_is_unknown() {
        let Verdict::Unknown { why } = page_size_verdict(2048) else {
            panic!("2 KiB pages are unclassified and must be Unknown, not assumed Pass");
        };
        assert!(why.contains("2048"), "{why}");
    }

    #[test]
    fn page_size_sysconf_error_is_unknown() {
        let Verdict::Unknown { why } = page_size_verdict(-1) else {
            panic!("sysconf failure must be Unknown");
        };
        assert!(why.contains("sysconf"), "{why}");
    }

    #[test]
    fn report_renders_one_human_readable_row_per_check() {
        let report = PreflightReport {
            va_bits: va_bits_verdict(Some(ARM64_CONFIG_VA48)),
            page_size: page_size_verdict(4096),
            read_ahead: read_ahead_verdict("sda", Some("65532\n"), Some("0\n")),
        };
        let text = report.to_string();
        assert!(text.contains("VA_BITS: PASS —"), "{text}");
        assert!(text.contains("PAGE SIZE: PASS —"), "{text}");
        assert!(text.contains("DISK READ-AHEAD: FAIL —"), "{text}");
    }
}
