# Oracle member (INTERCHANGEABLE AGENT, Phase 1).
# AUTHORED AHEAD OF THE BOX: not yet applied. Phase 2 enables this
# member in the door's upstream list; Phase 1 ships the unit so the
# box change and the door change stay one verbatim motion (ops/ law).
{ config, lib, pkgs, ... }:

{
  imports = [
    (import ./llama-server.nix {
      member = "oracle";
      # DEPLOY-TIME: the Oracle box's mesh address (x0x/tailnet address
      # of this host). The door reaches this member at ORACLE_MESH_ADDR.
      bindAddress = "ORACLE_MESH_ADDR";
      port = 8091;
      # DEPLOY-TIME: stage the same GGUF as the Hostinger member so the
      # pool serves one model identity on every member.
      modelPath = "/var/lib/llama-pool/models/Qwen3.5-4B-UD-Q4_K_XL-MTP.gguf";
      threads = 4;
    })
  ];
}
