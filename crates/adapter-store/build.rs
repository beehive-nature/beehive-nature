// Linux hosts only: compile the unprivileged network-denial shim used by
// tests/skv2_network_denial.rs. The blocker denies socket() for
// AF_INET/AF_INET6 at the libc boundary (ENETUNREACH) — the strongest
// denial available to an unprivileged process on hosts where rootless
// user+net namespaces are restricted (e.g. GitHub runners with
// kernel.apparmor_restrict_unprivileged_userns=1, where `unshare -rn`
// spawns but dies with EPERM). Path reaches the test via the
// SKV_PRELOAD_BLOCKER env baked at compile time.
fn main() {
    println!("cargo:rerun-if-changed=socket_block.c");
    #[cfg(target_os = "linux")]
    linux_blocker::build();
}

#[cfg(target_os = "linux")]
mod linux_blocker {
    pub fn build() {
        let out = std::env::var("OUT_DIR").expect("OUT_DIR");
        let lib = format!("{out}/libskv_socket_block.so");
        let compiler = cc::Build::new().get_compiler();
        let status = std::process::Command::new(compiler.to_string())
            .args(["-shared", "-fPIC", "-o", &lib, "socket_block.c"])
            .current_dir(std::env::var("CARGO_MANIFEST_DIR").unwrap())
            .status()
            .expect("compile socket_block.c");
        assert!(status.success(), "socket_block.c compile failed");
        println!("cargo:rustc-env=SKV_PRELOAD_BLOCKER={lib}");
    }
}
