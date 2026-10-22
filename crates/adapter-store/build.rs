// Linux hosts only: compile the unprivileged network-denial shim used by
// tests/skv2_network_denial.rs. The blocker denies socket() for
// AF_INET/AF_INET6 at the libc boundary (ENETUNREACH) — the strongest
// denial available to an unprivileged process on hosts where rootless
// user+net namespaces are restricted (e.g. GitHub runners with
// kernel.apparmor_restrict_unprivileged_userns=1, where `unshare -rn`
// spawns but dies with EPERM). A system C compiler is probed by name
// (cc/gcc/clang) so no build-dependency or Cargo.lock coupling is added.
// The path reaches the test via SKV_PRELOAD_BLOCKER baked at compile time.
fn main() {
    println!("cargo:rerun-if-changed=socket_block.c");
    #[cfg(target_os = "linux")]
    linux_blocker::build();
}

#[cfg(target_os = "linux")]
mod linux_blocker {
    pub fn build() {
        let manifest = std::env::var("CARGO_MANIFEST_DIR").expect("CARGO_MANIFEST_DIR");
        let out = std::env::var("OUT_DIR").expect("OUT_DIR");
        let lib = format!("{out}/libskv_socket_block.so");
        let src = format!("{manifest}/socket_block.c");
        let compiler = ["cc", "gcc", "clang"]
            .into_iter()
            .find(|c| {
                std::process::Command::new(c)
                    .arg("--version")
                    .output()
                    .is_ok_and(|o| o.status.success())
            })
            .expect("no C compiler (cc/gcc/clang) for socket_block.c");
        let status = std::process::Command::new(compiler)
            .args(["-shared", "-fPIC", "-o", &lib, &src])
            .status()
            .expect("compile socket_block.c");
        assert!(status.success(), "socket_block.c compile failed");
        println!("cargo:rustc-env=SKV_PRELOAD_BLOCKER={lib}");
    }
}
